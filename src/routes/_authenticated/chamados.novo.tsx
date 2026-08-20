import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, PRIORITY_LABEL, type TicketPriority } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/novo")({
  head: () => ({
    meta: [
      { title: "Abrir chamado — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Registre um novo chamado de suporte de T.I. informando categoria, prioridade e descrição do problema.",
      },
      { property: "og:title", content: "Abrir chamado — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Registre um novo chamado de suporte técnico em poucos segundos.",
      },
    ],
  }),
  component: NovoChamado,
});

function NovoChamado() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Hardware");
  const [priority, setPriority] = useState<TicketPriority>("media");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    const { data, error } = await supabase
      .from("tickets")
      .insert({ title, description, category, priority, requester_id: uid })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Não foi possível abrir o chamado", { description: error?.message });
      return;
    }
    toast.success("Chamado aberto com sucesso");
    navigate({ to: "/chamados/$id", params: { id: data.id } });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">Abrir chamado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Descreva o problema com o máximo de detalhes para agilizar o atendimento.
        </p>

        <form onSubmit={submit} className="panel mt-6 space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Notebook não conecta na rede Wi-Fi"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TicketPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              required
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que aconteceu, desde quando, mensagens de erro, equipamento envolvido..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/painel" })}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enviando..." : "Abrir chamado"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
