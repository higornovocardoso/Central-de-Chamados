import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { db, type ItilCategoryRow } from "@/integrations/supabase/glpi-db";
import { CATEGORIES, PRIORITY_LABEL, type TicketPriority } from "@/lib/tickets";
import {
  LEVELS,
  TICKET_TYPES,
  TICKET_TYPE_LABEL,
  levelLabel,
  previewPriority,
  type TicketType,
} from "@/lib/itil";

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
  const [type, setType] = useState<TicketType>("incidente");
  const [categoryId, setCategoryId] = useState<string>("");
  const [urgency, setUrgency] = useState(3);
  const [sourceId, setSourceId] = useState<string>("");

  // As listas da fase 3; se ainda não existem, o formulário usa as antigas.
  const lookups = useQuery({
    queryKey: ["itil_lookups_new"],
    queryFn: async () => {
      const [categories, sources] = await Promise.all([
        db.from("itil_categories").select("*").order("path"),
        db.from("request_sources").select("*").order("name"),
      ]);
      return {
        categories: (categories.data ?? []) as ItilCategoryRow[],
        sources: sources.data ?? [],
        available: !categories.error,
      };
    },
  });
  const phase3 = lookups.data?.available === true;

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
    const payload: Record<string, unknown> = {
      title,
      description,
      category,
      priority,
      requester_id: uid,
    };
    if (phase3) {
      payload["type"] = type;
      payload["urgency"] = urgency;
      payload["impact"] = 3;
      if (categoryId) payload["category_id"] = categoryId;
      if (sourceId) payload["request_source_id"] = sourceId;
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert(payload as never)
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
    <AppShell
      title="Criar chamado"
      subtitle="Descreva o problema com o máximo de detalhes para agilizar o atendimento."
      breadcrumbTail="Criar chamado"
    >
      <div className="mx-auto max-w-2xl">
        <form onSubmit={submit} className="panel space-y-5 p-6">
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

          {phase3 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TICKET_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem da requisição</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {(lookups.data?.sources ?? []).map((src) => (
                      <SelectItem key={src.id} value={src.id}>
                        {src.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria</Label>
              {phase3 ? (
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    const found = (lookups.data?.categories ?? []).find((c) => c.id === v);
                    if (found) setCategory(found.name);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(lookups.data?.categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {" ".repeat(c.level * 3)}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
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
              )}
            </div>
            <div className="space-y-2">
              <Label>{phase3 ? "Urgência" : "Prioridade"}</Label>
              {phase3 ? (
                <>
                  <Select value={String(urgency)} onValueChange={(v) => setUrgency(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={String(l)}>
                          {levelLabel(l)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Prioridade prevista: {levelLabel(previewPriority(urgency, 3))}. O técnico
                    define o impacto no atendimento.
                  </p>
                </>
              ) : (
                <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
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
              )}
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
