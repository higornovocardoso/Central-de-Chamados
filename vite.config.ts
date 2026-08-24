import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

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
      // NITRO_PRESET permite compilar para outro alvo sem editar o config —
      // usado para reproduzir erro de SSR localmente com "node-server".
      ...(command === "build" ? [nitro({ preset: process.env["NITRO_PRESET"] || "netlify" })] : []),
      viteReact(),
    ],
  };
});
