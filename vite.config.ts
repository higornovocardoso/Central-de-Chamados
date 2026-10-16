import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { ENDERECOS_ANTIGOS } from "./src/lib/enderecos-antigos";

/** Endereço antigo responde 301 na própria hospedagem, antes do app. */
const redirecionamentos = Object.fromEntries(
  Object.entries(ENDERECOS_ANTIGOS).map(([de, para]) => [
    de,
    { redirect: { to: para, status: 301 as const } },
  ]),
);

/**
 * A ordem dos plugins importa: tailwind, caminhos do tsconfig, TanStack Start,
 * nitro e por último o react. Trocar a ordem quebra a transformação das rotas.
 *
 * O nitro entra só no build; em desenvolvimento o próprio vite serve.
 */
export default defineConfig(({ mode, command }) => {
  // As VITE_* viram literais no bundle. Sem isto o cliente fica sem a URL e a
  // chave do Supabase, porque no navegador não existe process.env.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(env)) {
    define[`import.meta.env.${chave}`] = JSON.stringify(valor);
  }

  return {
    define,
    css: { transformer: "lightningcss" as const },
    server: { port: 8080 },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      // Duas cópias de react ou do react-query em memória quebram os hooks.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // src/server.ts embrulha o handler de SSR para capturar erro.
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // O alvo é a Vercel. NITRO_PRESET força outro, por exemplo "node-server"
      // para reproduzir erro de SSR localmente.
      ...(command === "build"
        ? [
            nitro({
              preset: process.env["NITRO_PRESET"] || "vercel",
              routeRules: {
                ...redirecionamentos,
                // Os cabeçalhos de segurança das telas saem de src/server.ts;
                // estes cobrem os arquivos estáticos, que não passam por lá.
                "/assets/**": {
                  headers: {
                    "cache-control": "public, max-age=31536000, immutable",
                    "x-content-type-options": "nosniff",
                  },
                },
              },
            }),
          ]
        : []),
      viteReact(),
    ],
  };
});
