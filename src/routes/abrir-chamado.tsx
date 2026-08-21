import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Headset,
  Loader2,
  Mail,
  Send,
  Building2,
  User,
} from "lucide-react";
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
import { CATEGORIES, PRIORITY_LABEL, ticketCode, type TicketPriority } from "@/lib/tickets";
import { createPublicTicket, publicTicketSchema } from "@/lib/public-tickets.functions";

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

const HIGHLIGHTS = [
  {
    icon: Headset,
    title: "Atendimento centralizado",
    text: "Sua solicitação vai direto para a fila da equipe de T.I.",
  },
  {
    icon: Clock3,
    title: "Prazos acompanhados",
    text: "Cada chamado recebe prazos de resposta e solução automáticos.",
  },
  {
    icon: Mail,
    title: "Retorno por e-mail",
    text: "As atualizações chegam no e-mail que você informar aqui.",
  },
];

function AbrirChamado() {
  const submit = useServerFn(createPublicTicket);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [priority, setPriority] = useState<TicketPriority>("media");
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
      priority,
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="rise-in grid w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        {/* Vitrine — contexto do atendimento */}
        <section className="relative hidden flex-col items-center justify-center bg-[#131a2b] p-8 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-primary/25 blur-3xl"
          />

          <div className="relative text-center">
            <h1 className="text-2xl font-semibold leading-tight">Suporte de T.I.</h1>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              Registre seu problema e acompanhe a solução.
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

        {/* Formulário */}
        <section className="flex flex-col justify-center p-7 sm:p-9">
          {created ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" />
              <h2 className="text-xl font-semibold tracking-tight">Chamado enviado!</h2>
              <p className="text-sm text-muted-foreground">
                Seu protocolo é <strong className="text-foreground">{ticketCode(created)}</strong>. A
                equipe de T.I. já recebeu a solicitação e entrará em contato pelo e-mail informado.
              </p>
              <Button
                variant="secondary"
                className="h-11 w-full rounded-lg"
                onClick={() => setCreated(null)}
              >
                Abrir outro chamado
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold tracking-tight">Abrir chamado de suporte</h2>
                <p className="mt-1 text-sm text-muted-foreground">Preencha o formulário abaixo.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                        className="h-11 rounded-lg pl-9"
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
                        className="h-11 rounded-lg pl-9"
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
                      className="h-11 rounded-lg pl-9"
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
                    className="h-11 rounded-lg"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-11 rounded-lg">
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
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                      <SelectTrigger className="h-11 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((item) => (
                          <SelectItem key={item} value={item}>
                            {PRIORITY_LABEL[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs">
                    Descrição
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={4}
                    placeholder="Descreva o que está acontecendo, mensagens de erro e desde quando ocorre."
                    className="rounded-lg"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="h-11 w-full rounded-lg text-sm"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {saving ? "Enviando..." : "Enviar chamado"}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
