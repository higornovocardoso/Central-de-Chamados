import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { LEVELS, LEVEL_CLASS, levelLabel, previewPriority } from "@/lib/itil";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/mudancas")({
  head: () => ({
    meta: [
      { title: "Mudanças" },
      {
        name: "description",
        content: "Mudanças na infraestrutura, com análise, plano de implantação e retorno.",
      },
    ],
  }),
  component: Mudancas,
});

/** Os status de mudança do GLPI, incluindo as fases de teste e qualificação. */
const STATUS = [
  { value: "nova", label: "Nova" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "aceita", label: "Aceita" },
  { value: "planejada", label: "Planejada" },
  { value: "em_execucao", label: "Em execução" },
  { value: "teste", label: "Teste" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "aplicada", label: "Aplicada" },
  { value: "revisao", label: "Revisão" },
  { value: "fechada", label: "Fechada" },
  { value: "cancelada", label: "Cancelada" },
];

const DONE = new Set(["aplicada", "fechada"]);

const EMPTY = {
  title: "",
  description: "",
  status: "nova",
  urgency: 3,
  impact: 3,
  impacts: "",
  control_list: "",
  deployment_plan: "",
  backup_plan: "",
  checklist: "",
  planned_start: "",
  planned_end: "",
  solution: "",
};

function Mudancas() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const queryClient = useQueryClient();
  const canWrite = can("change", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const listQuery = useQuery({
    queryKey: ["changes"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("changes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selected) return;
    setCreating(false);
    setForm({
      title: String(selected["title"] ?? ""),
      description: String(selected["description"] ?? ""),
      status: String(selected["status"] ?? "nova"),
      urgency: Number(selected["urgency"] ?? 3),
      impact: Number(selected["impact"] ?? 3),
      impacts: String(selected["impacts"] ?? ""),
      control_list: String(selected["control_list"] ?? ""),
      deployment_plan: String(selected["deployment_plan"] ?? ""),
      backup_plan: String(selected["backup_plan"] ?? ""),
      checklist: String(selected["checklist"] ?? ""),
      planned_start: String(selected["planned_start"] ?? "").slice(0, 16),
      planned_end: String(selected["planned_end"] ?? "").slice(0, 16),
      solution: String(selected["solution"] ?? ""),
    });
  }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Informe o título da mudança.");
      const payload = {
        ...form,
        title: form.title.trim(),
        urgency: Number(form.urgency),
        impact: Number(form.impact),
        planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
        planned_end: form.planned_end ? new Date(form.planned_end).toISOString() : null,
        entity_id: entities[0]?.value ?? null,
      };
      const { error } =
        selected && !creating
          ? await looseDb.from("changes").update(payload).eq("id", selected.id)
          : await looseDb.from("changes").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(creating ? "Mudança criada." : "Mudança atualizada.");
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("changes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const changes = listQuery.data ?? [];
  const editing = creating || Boolean(selected);

  const textArea = (key: keyof typeof EMPTY, label: string, rows = 4) => (
    <div className="space-y-1">
      <Label className="text-[0.7rem] text-muted-foreground">{label}</Label>
      <Textarea
        rows={rows}
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="text-xs"
        disabled={!canWrite}
      />
    </div>
  );

  return (
    <AppShell
      title="Mudanças"
      subtitle="Trocar servidor, migrar sistema, mexer na rede — com plano de retorno escrito antes."
      breadcrumbTail="Mudanças"
      actions={
        can("change", "create") ? (
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
          <header className="panel-header">Mudanças ({changes.length})</header>
          <ul className="divide-y divide-border">
            {listQuery.isError && (
              <li className="px-3 py-4 text-xs text-muted-foreground">
                A tabela ainda não existe no banco. Aplique a migration da fase 7.
              </li>
            )}
            {changes.length === 0 && !listQuery.isError && (
              <li className="px-3 py-4 text-xs text-muted-foreground">
                Nenhuma mudança registrada.
              </li>
            )}
            {changes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                    c.id === selected?.id ? "bg-primary/10" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">{String(c["title"])}</span>
                    <Tag className={LEVEL_CLASS[Number(c["priority_level"] ?? 3)] ?? ""}>
                      {levelLabel(Number(c["priority_level"] ?? 3))}
                    </Tag>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                    <Tag
                      className={
                        DONE.has(String(c["status"]))
                          ? "border-success/30 bg-success/15 text-success"
                          : "border-border bg-secondary text-muted-foreground"
                      }
                    >
                      {STATUS.find((s) => s.value === c["status"])?.label}
                    </Tag>
                    <span>{formatDate(String(c["created_at"]))}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div>
          {!editing ? (
            <section className="panel p-10 text-center text-xs text-muted-foreground">
              Escolha uma mudança à esquerda, ou crie uma nova.
            </section>
          ) : (
            <Tabs defaultValue="mudanca">
              <TabsList className="min-h-8">
                <TabsTrigger value="mudanca" className="text-xs">
                  Mudança
                </TabsTrigger>
                <TabsTrigger value="analise" className="text-xs">
                  Análise
                </TabsTrigger>
                <TabsTrigger value="planos" className="text-xs">
                  Planos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mudanca" className="mt-3">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">
                        Início planejado
                      </Label>
                      <Input
                        type="datetime-local"
                        value={form.planned_start}
                        onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                        className="h-8 text-xs"
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Fim planejado</Label>
                      <Input
                        type="datetime-local"
                        value={form.planned_end}
                        onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                        className="h-8 text-xs"
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                  {textArea("description", "Descrição", 5)}
                  {textArea("solution", "Resultado", 3)}
                  {canWrite && (
                    <div className="flex justify-end gap-2">
                      {selected && !creating && can("change", "delete") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => remove.mutate(selected.id)}
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </Button>
                      )}
                      <Button size="sm" className="h-8" onClick={() => save.mutate()}>
                        Salvar
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="analise" className="mt-3">
                <section className="panel space-y-3 p-3">
                  {textArea("impacts", "Impactos")}
                  {textArea("control_list", "Lista de controle")}
                  {canWrite && (
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8" onClick={() => save.mutate()}>
                        Salvar análise
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="planos" className="mt-3">
                <section className="panel space-y-3 p-3">
                  <p className="text-[0.72rem] text-muted-foreground">
                    O plano de retorno é o que salva a segunda-feira: escreva antes de executar.
                  </p>
                  {textArea("deployment_plan", "Plano de implantação", 5)}
                  {textArea("backup_plan", "Plano de retorno", 5)}
                  {textArea("checklist", "Checklist", 5)}
                  {canWrite && (
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8" onClick={() => save.mutate()}>
                        Salvar planos
                      </Button>
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
