import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, Mail, Send, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, ticketCode } from "@/lib/tickets";
import { createPublicTicket, publicTicketSchema } from "@/lib/public-tickets.functions";

/**
 * Rótulos escritos do ponto de vista de quem abre o chamado, não do manual de
 * ITIL: "paralisado" diz mais que "muito alta" para quem só quer voltar a
 * trabalhar. Os números são os mesmos que a priority_matrix espera.
 */
const URGENCIAS = [
  { valor: 1, rotulo: "Posso esperar" },
  { valor: 2, rotulo: "Pouco urgente" },
  { valor: 3, rotulo: "Normal" },
  { valor: 4, rotulo: "Urgente" },
  { valor: 5, rotulo: "Estou paralisado" },
];

export const Route = createFileRoute("/abrir-chamado")({
  head: () => ({
    meta: [
      { title: "Abrir chamado" },
      {
        name: "description",
        content:
          "Formulário para colaboradores registrarem chamados de suporte de T.I. sem precisar de login.",
      },
      { property: "og:title", content: "Abrir chamado" },
      {
        property: "og:description",
        content: "Descreva seu problema de T.I. e a equipe de suporte receberá o chamado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AbrirChamado,
});

/** O caminho do chamado, do lado de quem pede: é uma sequência de verdade. */
const PASSOS = [
  {
    titulo: "Descreva o problema",
    texto: "Assunto, o que acontece e desde quando. Quanto mais detalhe, mais rápido.",
  },
  {
    titulo: "A equipe recebe na hora",
    texto: "O chamado entra na fila com prazo de atendimento e de solução.",
  },
  {
    titulo: "Acompanhe pelo e-mail",
    texto: "Cada resposta do técnico chega no endereço que você informar.",
  },
];

function AbrirChamado() {
  const submit = useServerFn(createPublicTicket);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [urgency, setUrgency] = useState(3);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const parsed = publicTicketSchema.safeParse({
      reporter_name: String(form.get("name") ?? ""),
      reporter_email: String(form.get("email") ?? ""),
      reporter_sector: String(form.get("sector") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      category,
      urgency,
    });

    if (!parsed.success) {
      toast.error("Confira os dados do chamado", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await submit({ data: parsed.data });
      setCreated(res.id);
    } catch (error) {
      toast.error("Não foi possível enviar o chamado. Tente novamente em instantes.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-10 sm:px-6 lg:py-16">
      <div className="aura" aria-hidden="true" />

      <div className="relative z-[1] mx-auto grid w-full max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        {/* Contexto: o que acontece depois de enviar */}
        <section className="rise-in lg:sticky lg:top-16">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.32em] text-primary">
            Suporte de T.I.
          </p>
          <h1 className="mt-3 text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.04em] [text-wrap:balance] sm:text-[2.75rem]">
            Conte o que aconteceu. A equipe de T.I. assume daqui.
          </h1>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            Não precisa de login. Preencha o formulário e guarde o protocolo que aparece no fim.
          </p>

          <ol className="relative mt-9 hidden space-y-6 sm:block">
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-[0.9375rem] top-3 w-px bg-[linear-gradient(180deg,var(--primary),var(--ice),transparent)] opacity-50"
            />
            {PASSOS.map((passo, i) => (
              <li
                key={passo.titulo}
                className="rise-in relative flex gap-4"
                style={{ "--d": `${150 + i * 110}ms` } as React.CSSProperties}
              >
                <span className="relative z-[1] flex size-[1.875rem] shrink-0 items-center justify-center rounded-full border border-primary/30 bg-surface font-mono text-xs font-medium text-primary shadow-[0_0_0_4px_var(--background)]">
                  {i + 1}
                </span>
                <span className="pt-1">
                  <span className="block text-sm font-semibold">{passo.titulo}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">
                    {passo.texto}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <EntrarEquipe className="mt-9 hidden lg:block" />
        </section>

        {/* Formulário, ou o protocolo depois de enviar */}
        {created ? (
          <div
            className="feixe dark rise-in text-foreground shadow-[0_40px_100px_-30px_rgb(42_91_255/0.45)]"
            style={{ borderRadius: 20 }}
          >
            <section
              className="palco flex flex-col items-center px-7 py-12 text-center sm:px-12"
              style={{ borderRadius: 19 }}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success shadow-[0_0_40px_-6px_var(--success)]">
                <CheckCircle2 className="size-7" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Chamado enviado</h2>
              <p className="mt-2 text-sm text-muted-foreground">Guarde o seu protocolo:</p>
              <p className="mt-3 rounded-xl border border-border bg-white/[0.04] px-5 py-2.5 font-mono text-2xl tracking-[0.08em] text-ice">
                {ticketCode(created)}
              </p>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ele já está na fila da equipe de T.I. As respostas chegam no e-mail que você
                informou.
              </p>
              <Button variant="outline" className="mt-8 h-11 px-6" onClick={() => setCreated(null)}>
                Abrir outro chamado
              </Button>
            </section>
          </div>
        ) : (
          <section
            className="panel rise-in p-6 sm:p-8"
            style={{ "--d": "90ms" } as React.CSSProperties}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Abrir chamado</h2>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Os campos com nome e e-mail servem para a equipe responder você.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">
                    Seu nome
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      required
                      minLength={2}
                      placeholder="Nome completo"
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">
                    E-mail para contato
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="voce@empresa.com"
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sector" className="text-xs">
                  Setor / departamento
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sector"
                    name="sector"
                    placeholder="Ex.: Financeiro"
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">
                  Assunto
                </Label>
                <Input
                  id="title"
                  name="title"
                  required
                  minLength={3}
                  placeholder="Resumo do problema"
                  className="h-11"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Urgência</Label>
                  <Select value={String(urgency)} onValueChange={(v) => setUrgency(Number(v))}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCIAS.map((item) => (
                        <SelectItem key={item.valor} value={String(item.valor)}>
                          {item.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                A urgência é o quanto isso atrapalha seu trabalho agora. A equipe define a
                prioridade final considerando quantas pessoas foram afetadas.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={5}
                  placeholder="O que está acontecendo, mensagens de erro e desde quando ocorre."
                />
              </div>

              <Button type="submit" disabled={saving} className="h-11 w-full text-sm">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {saving ? "Enviando…" : "Enviar chamado"}
              </Button>
            </form>
          </section>
        )}

        {/* No celular e no tablet a coluna de contexto vem antes; o atalho fica no fim. */}
        <EntrarEquipe className="text-center lg:hidden" />
      </div>
    </main>
  );
}

function EntrarEquipe({ className }: { className: string }) {
  return (
    <p className={`text-[0.8125rem] text-muted-foreground ${className}`}>
      É da equipe de T.I.?{" "}
      <Link to="/auth" className="font-medium text-primary hover:underline">
        Entrar no sistema
      </Link>
    </p>
  );
}
