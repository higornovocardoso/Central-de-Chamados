import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LifeBuoy, Send, CheckCircle2 } from "lucide-react";
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
import { createPublicTicket } from "@/lib/public-tickets.functions";

export const Route = createFileRoute("/abrir-chamado")({
  head: () => ({
    meta: [
      { title: "Abrir chamado de T.I. — Helpdesk" },
      {
        name: "description",
        content:
          "Formulário para colaboradores registrarem chamados de suporte de T.I. sem precisar de login.",
      },
      { property: "og:title", content: "Abrir chamado de T.I. — Helpdesk" },
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

function AbrirChamado() {
  const submit = useServerFn(createPublicTicket);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const res = await submit({
        data: {
          reporter_name: String(form.get("name") ?? ""),
          reporter_email: String(form.get("email") ?? ""),
          reporter_sector: String(form.get("sector") ?? ""),
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          category,
          priority,
        },
      });
      setCreated(res.id);
    } catch (error) {
      toast.error("Não foi possível enviar o chamado. Confira os dados e tente novamente.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LifeBuoy className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">Helpdesk T.I.</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {created ? (
          <div className="panel space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h1 className="font-display text-2xl font-semibold">Chamado enviado!</h1>
            <p className="text-sm text-muted-foreground">
              Seu protocolo é <strong className="text-foreground">{ticketCode(created)}</strong>. A
              equipe de T.I. já recebeu a solicitação e entrará em contato pelo e-mail informado.
            </p>
            <Button variant="secondary" onClick={() => setCreated(null)}>
              Abrir outro chamado
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Abrir chamado de suporte
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha o formulário abaixo. Não é necessário ter login.
            </p>

            <form onSubmit={handleSubmit} className="panel mt-6 space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input id="name" name="name" required minLength={2} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail para contato</Label>
                  <Input id="email" name="email" type="email" required placeholder="voce@empresa.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Setor / departamento</Label>
                <Input id="sector" name="sector" placeholder="Ex.: Financeiro" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Assunto</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  minLength={3}
                  placeholder="Resumo do problema"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                    <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={5}
                  placeholder="Descreva o que está acontecendo, mensagens de erro e desde quando ocorre."
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                <Send className="size-4" /> {saving ? "Enviando..." : "Enviar chamado"}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
