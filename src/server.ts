import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Import estático de propósito. Com import() dinâmico o empacotador cria um
// chunk-fachada que reexporta do chunk grande de SSR e, ao mesmo tempo, guarda
// o runtime (__exportAll) que esse mesmo chunk precisa — um ciclo. Em Node o
// chunk grande avalia primeiro e chama __exportAll antes da atribuição, o que
// derruba todo pedido com "__exportAll is not a function". No Workers a ordem
// de avaliação escondia o problema. Nada se ganha adiando: o servidor precisa
// deste módulo em todo pedido.
import * as serverEntryModule from "@tanstack/react-start/server-entry";

const serverEntry = ((serverEntryModule as { default?: ServerEntry }).default ??
  serverEntryModule) as unknown as ServerEntry;

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Política de conteúdo. O 'unsafe-inline' em scripts existe porque o SSR do
 * TanStack Start e o script do tema (antes da primeira pintura) são inline;
 * o resto fecha o que um XSS precisaria: nada de plugin, nada de outro site
 * embutindo a central num quadro, formulários só para o próprio endereço e
 * conexões só com o próprio site e o Supabase.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const CABECALHOS_DE_SEGURANCA: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function comCabecalhosDeSeguranca(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
    headers.set(nome, valor);
  }
  // Telas e funções do servidor nunca podem ser guardadas por proxy: mostram
  // dado de quem está logado. Os arquivos de /assets/ têm o próprio cache.
  if (!headers.has("cache-control")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const response = await serverEntry.fetch(request, env, ctx);
      return comCabecalhosDeSeguranca(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return comCabecalhosDeSeguranca(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
