import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EntityProvider } from "@/contexts/entity";

/** Fundo das telas soltas (404, erro): a mesma luz e grade do topo das páginas. */
function TelaSolta({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="aura" aria-hidden="true" />
      <div className="rise-in relative z-[1] max-w-md text-center">{children}</div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <TelaSolta>
      <p className="font-mono text-sm tracking-[0.3em] text-muted-foreground">ERRO 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Esta página não existe
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O endereço pode ter mudado. Volte ao painel para continuar de onde estava.
      </p>
      <div className="mt-7">
        <Link to="/" className={buttonVariants({ className: "h-10 px-5" })}>
          Ir para o painel
        </Link>
      </div>
    </TelaSolta>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <TelaSolta>
      <p className="font-mono text-sm tracking-[0.3em] text-destructive">FALHA</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Esta página não carregou
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Algo deu errado do nosso lado. Tente de novo; se continuar, volte ao painel.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className={buttonVariants({ className: "h-10 px-5" })}
        >
          Tentar de novo
        </button>
        <a href="/" className={buttonVariants({ variant: "outline", className: "h-10 px-5" })}>
          Ir para o painel
        </a>
      </div>
    </TelaSolta>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content: "Sistema interno para abertura e acompanhamento de chamados de suporte de T.I.",
      },
      {
        property: "og:description",
        content: "Sistema interno para abertura e acompanhamento de chamados de suporte de T.I.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Ícone transparente de propósito: não ter ícone nenhum não apaga o que
      // ficou no cache do navegador — um 404 não manda esquecer o anterior.
      // Servindo este, o antigo é sobrescrito e a aba fica sem logo de fato.
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const THEME_BOOT = `try{if(localStorage.getItem("central.tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Aplica o tema salvo antes da primeira pintura, para a tela não
            piscar clara em quem escolheu o escuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <EntityProvider>
        <Outlet />
        <Toaster position="bottom-right" />
      </EntityProvider>
    </QueryClientProvider>
  );
}
