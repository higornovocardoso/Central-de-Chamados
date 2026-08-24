import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Eye, EyeOff, Gauge, Loader2, LockKeyhole, Mail, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const HIGHLIGHTS = [
  {
    icon: Gauge,
    title: "Painel em tempo real",
    text: "Chamados abertos, pendências e carga por técnico em uma só tela.",
  },
  {
    icon: Timer,
    title: "SLA sob controle",
    text: "Prazos de atendimento e solução calculados automaticamente.",
  },
  {
    icon: BookOpen,
    title: "Base de conhecimento",
    text: "Soluções recorrentes documentadas e prontas para reaproveitar.",
  },
];

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="rise-in grid w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl lg:grid-cols-[1.05fr_1fr]">
        {/* Vitrine do sistema — dá contexto sem poluir o formulário */}
        <section className="relative hidden flex-col items-center justify-center bg-[#131a2b] p-8 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-[#8b5cf6]/25 blur-3xl"
          />

          <div className="relative text-center">
            <h1 className="text-2xl font-semibold leading-tight">Central de chamados de T.I.</h1>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              Atendimento, ativos e conhecimento em um só lugar.
            </p>
          </div>

          <ul className="relative mt-8 space-y-4">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.title}
                className="rise-in flex gap-3"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <item.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-white/65">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Formulário de acesso */}
        <section className="flex flex-col justify-center p-7 sm:p-9">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Bem-vindo de volta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com sua conta para continuar.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                E-mail corporativo
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
                  className="h-11 rounded-lg pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-xs">
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
                  className="h-11 rounded-lg pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-11 w-full rounded-lg text-sm" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
