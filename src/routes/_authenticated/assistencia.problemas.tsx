import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { LEVELS, LEVEL_CLASS, levelLabel, previewPriority } from "@/lib/itil";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/problemas")({
  head: () => ({
    meta: [
      { title: "Problemas — Helpdesk T.I." },
      {
        name: "description",
        content: "A causa por trás dos incidentes: impactos, causas e sintomas.",
      },
    ],
  }),
  component: Problemas,
});

const STATUS = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando", label: "Pendente" },
  { value: "solucionado", label: "Solucionado" },
  { value: "fechado", label: "Fechado" },
];

const STATUS_CLASS: Record<string, string> = {
  novo: "bg-info/15 text-info border-info/30",
  em_analise: "bg-primary/25 text-foreground border-primary/50",
  aguardando: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  solucionado: "bg-success/15 text-success border-success/30",
  fechado: "bg-secondary text-muted-foreground border-border",
};

const EMPTY = {
  title: "",
  description: "",
  status: "novo",
  urgency: 3,
  impact: 3,
  impacts: "",
  causes: "",
  symptoms: "",
  solution: "",
};

function Problemas() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const queryClient = useQueryClient();
  const canWrite = can("problem", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [followup, setFollowup] = useState("");

  const listQuery = useQuery({
    queryKey: ["problems"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("problems")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const followupsQuery = useQuery({
    queryKey: ["itil_followups_problem", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data } = await looseDb
        .from("itil_followups")
        .select("*")
        .eq("item_id", String(selected?.id))
        .order("created_at");
      return (data ?? []).filter((f) => f["item_type"] === "problem");
    },
  });

  const relationsQuery = useQuery({
    queryKey: ["itil_relations_problem", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data } = await looseDb
        .from("itil_relations")
        .select("*")
        .eq("source_id", String(selected?.id))
        .order("id");
      return data ?? [];
    },
  });

  const ticketsQuery = useQuery({
    queryKey: ["tickets_for_link"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id,title")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selected) return;
    setCreating(false);
    setForm({
      title: String(selected["title"] ?? ""),
      description: String(selected["description"] ?? ""),
      status: String(selected["status"] ?? "novo"),
      urgency: Number(selected["urgency"] ?? 3),
      impact: Number(selected["impact"] ?? 3),
      impacts: String(selected["impacts"] ?? ""),
      causes: String(selected["causes"] ?? ""),
      symptoms: String(selected["symptoms"] ?? ""),
      solution: String(selected["solution"] ?? ""),
    });
  }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Informe o título do problema.");
      const payload = {
        ...form,
        title: form.title.trim(),
        urgency: Number(form.urgency),
        impact: Number(form.impact),
        entity_id: entities[0]?.value ?? null,
        resolved_at: form.status === "solucionado" ? new Date().toISOString() : null,
      };
      const { error } =
        selected && !creating
          ? await looseDb.from("problems").update(payload).eq("id", selected.id)
          : await looseDb.from("problems").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(creating ? "Problema criado." : "Problema atualizado.");
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["problems"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("problems").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["problems"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const addFollowup = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await looseDb.from("itil_followups").insert({
        item_type: "problem",
        item_id: selected?.id,
        author_id: userData.user?.id ?? null,
        body: followup.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setFollowup("");
      queryClient.invalidateQueries({ queryKey: ["itil_followups_problem", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível registrar", { description: e.message }),
  });

  const linkTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await looseDb.from("itil_relations").insert({
        source_type: "problem",
        source_id: selected?.id,
        target_type: "ticket",
        target_id: ticketId,
        link_type: "ligado",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["itil_relations_problem", selected?.id] }),
    onError: (e: Error) => toast.error("Não foi possível vincular", { description: e.message }),
  });

  const problems = listQuery.data ?? [];
  const editing = creating || Boolean(selected);

  return (
    <AppShell
      title="Problemas"
      subtitle="Quando o mesmo incidente volta, o problema é a causa por trás dele."
      breadcrumbTail="Problemas"
      actions={
        can("problem", "create") ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              setSelected(null);
              setForm(EMPTY);
              setCreating(true);
            }}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null
      }
    >
      <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
        <section className="panel h-fit overflow-hidden">
          <header className="panel-header">Problemas ({problems.length})</header>
          <ul className="divide-y divide-border">
            {listQuery.isError && (
              <li className="px-3 py-4 text-xs text-muted-foreground">
                A tabela ainda não existe no banco. Aplique a migration da fase 7.
              </li>
            )}
            {problems.length === 0 && !listQuery.isError && (
              <li className="px-3 py-4 text-xs text-muted-foreground">
                Nenhum problema registrado.
              </li>
            )}
            {problems.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                    p.id === selected?.id ? "bg-primary/10" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">{String(p["title"])}</span>
                    <Tag className={LEVEL_CLASS[Number(p["priority_level"] ?? 3)] ?? ""}>
                      {levelLabel(Number(p["priority_level"] ?? 3))}
                    </Tag>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                    <Tag className={STATUS_CLASS[String(p["status"])] ?? ""}>
                      {STATUS.find((s) => s.value === p["status"])?.label}
                    </Tag>
                    <span>{formatDate(String(p["created_at"]))}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div>
          {!editing ? (
            <section className="panel p-10 text-center text-xs text-muted-foreground">
              Escolha um problema à esquerda, ou crie um novo.
            </section>
          ) : (
            <Tabs defaultValue="problema">
              <TabsList className="min-h-8">
                <TabsTrigger value="problema" className="text-xs">
                  Problema
                </TabsTrigger>
                <TabsTrigger value="analise" className="text-xs">
                  Análise
                </TabsTrigger>
                <TabsTrigger value="acompanhamentos" className="text-xs" disabled={creating}>
                  Acompanhamentos ({followupsQuery.data?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="chamados" className="text-xs" disabled={creating}>
                  Chamados ({relationsQuery.data?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="problema" className="mt-3">
                <section className="panel space-y-3 p-3">
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Título *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="h-8 text-xs"
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Status</Label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                        disabled={!canWrite}
                      >
                        {STATUS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Urgência</Label>
                      <select
                        value={form.urgency}
                        onChange={(e) => setForm({ ...form, urgency: Number(e.target.value) })}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                        disabled={!canWrite}
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {levelLabel(l)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Impacto</Label>
                      <select
                        value={form.impact}
                        onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                        disabled={!canWrite}
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {levelLabel(l)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[0.72rem] text-muted-foreground">
                    Prioridade calculada:{" "}
                    <strong>{levelLabel(previewPriority(form.urgency, form.impact))}</strong>
                  </p>
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Descrição</Label>
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="text-xs"
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Solução</Label>
                    <Textarea
                      rows={3}
                      value={form.solution}
                      onChange={(e) => setForm({ ...form, solution: e.target.value })}
                      className="text-xs"
                      disabled={!canWrite}
                    />
                  </div>
                  {canWrite && (
                    <div className="flex justify-end gap-2">
                      {selected && !creating && can("problem", "delete") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => remove.mutate(selected.id)}
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => save.mutate()}
                        disabled={save.isPending}
                      >
                        Salvar
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="analise" className="mt-3">
                <section className="panel space-y-3 p-3">
                  <p className="text-[0.72rem] text-muted-foreground">
                    A aba Análise do GLPI: o que o problema afeta, o que o causa e como ele
                    aparece.
                  </p>
                  {(
                    [
                      ["impacts", "Impactos"],
                      ["causes", "Causas"],
                      ["symptoms", "Sintomas"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">{label}</Label>
                      <Textarea
                        rows={4}
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="text-xs"
                        disabled={!canWrite}
                      />
                    </div>
                  ))}
                  {canWrite && (
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8" onClick={() => save.mutate()}>
                        Salvar análise
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="acompanhamentos" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Acompanhamentos</header>
                  <ul className="divide-y divide-border">
                    {(followupsQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Nenhum acompanhamento.
                      </li>
                    )}
                    {(followupsQuery.data ?? []).map((f) => (
                      <li key={f.id} className="px-3 py-2.5">
                        <p className="text-[0.7rem] text-muted-foreground">
                          {formatDate(String(f["created_at"]))}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs">{String(f["body"])}</p>
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="space-y-2 border-t border-border p-3">
                      <Textarea
                        rows={3}
                        value={followup}
                        onChange={(e) => setFollowup(e.target.value)}
                        placeholder="Escreva um acompanhamento..."
                        className="text-xs"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => addFollowup.mutate()}
                          disabled={!followup.trim()}
                        >
                          <Send className="size-3.5" /> Adicionar
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="chamados" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Chamados originados por este problema</header>
                  <ul className="divide-y divide-border">
                    {(relationsQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Nenhum chamado vinculado.
                      </li>
                    )}
                    {(relationsQuery.data ?? []).map((r) => (
                      <li key={r.id} className="px-3 py-2 text-xs">
                        {(ticketsQuery.data ?? []).find((t) => t.id === r["target_id"])?.title ??
                          "Chamado removido"}
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="border-t border-border p-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) linkTicket.mutate(e.target.value);
                          e.target.value = "";
                        }}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Vincular um chamado</option>
                        {(ticketsQuery.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </section>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AppShell>
  );
}
