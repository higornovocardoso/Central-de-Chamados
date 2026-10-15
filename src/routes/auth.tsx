import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Convergencia } from "@/components/Convergencia";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar" },
      {
        name: "description",
        content: "Acesse para abrir, acompanhar e resolver chamados de suporte técnico.",
      },
      { property: "og:title", content: "Entrar" },
      {
        property: "og:description",
        content: "Acesse para abrir e acompanhar chamados de suporte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/**
 * Entrada do sistema. É sempre escura, em qualquer tema: um palco onde linhas
 * de luz trazem os chamados das bordas até o centro, e o cartão de acesso
 * está ali, com o feixe na borda.
 */
function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", {
        description:
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message,
      });
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  return (
    <main className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#04060c] px-4 py-12 text-foreground">
      {/* Fundo: luz no centro, grade fina e as linhas que convergem. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_50%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,#000_20%,transparent_75%)]"
      />
      <Convergencia />

      <div className="relative z-[1] flex w-full flex-col items-center">
        <header className="rise-in mb-8 max-w-[40rem] text-center">
          <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.32em] text-ice/80">
            Suporte de T.I.
          </p>
          <h1 className="bg-[linear-gradient(180deg,#ffffff,#b9c6e4)] bg-clip-text text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.045em] text-transparent sm:text-[3rem]">
            Central de chamados
          </h1>
          <p className="mx-auto mt-3 max-w-[22rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Toda solicitação de T.I. chega aqui, com prazo, responsável e histórico.
          </p>
        </header>

        {/* A entrada fica no invólucro de fora: no mesmo elemento, ela travaria o giro do feixe. */}
        <div
          className="rise-in w-full max-w-[25rem]"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          <div
            className="feixe shadow-[0_40px_100px_-30px_rgb(42_91_255/0.45)]"
            style={{ borderRadius: 20 }}
          >
            {/* Cartão opaco: o feixe aparece só na borda, não atravessa o miolo. */}
            <section
              className="bg-[linear-gradient(180deg,#0d1424,#0a0f1c)] px-6 pb-6 pt-7 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:px-8"
              style={{ borderRadius: 19 }}
            >
              <div className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight">Entrar</h2>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                  Use o e-mail e a senha da sua conta.
                </p>
              </div>

              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-secondary-foreground">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      className="h-11 pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="senha" className="text-xs text-secondary-foreground">
                    Senha
                  </Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="mt-2 h-11 w-full text-sm" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>

              <div className="mt-6 border-t border-border pt-5 text-center text-[0.8125rem] text-muted-foreground">
                Não tem conta?{" "}
                <Link
                  to="/abrir-chamado"
                  className="group inline-flex items-center gap-1 font-medium text-ice transition-colors hover:text-white"
                >
                  Abra um chamado sem login
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
