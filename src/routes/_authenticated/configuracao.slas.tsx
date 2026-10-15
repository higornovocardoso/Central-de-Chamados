import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/configuracao/slas")({
  head: () => ({
    meta: [
      { title: "Níveis de serviço" },
      {
        name: "description",
        content: "SLA e OLA com prazo de atendimento, prazo de solução e níveis de escalonamento.",
      },
    ],
  }),
  component: NiveisDeServico,
});

const KINDS = [
  { value: "sla", label: "SLA (com o cliente)" },
  { value: "ola", label: "OLA (entre times internos)" },
];

const TARGETS = [
  { value: "tto", label: "TTO — prazo de atendimento" },
  { value: "ttr", label: "TTR — prazo de solução" },
];

const UNITS = [
  { value: "minuto", label: "Minutos" },
  { value: "hora", label: "Horas" },
  { value: "dia", label: "Dias" },
];

const ACTION_TYPES = [
  { value: "campo", label: "Alterar um campo do chamado" },
  { value: "notificar", label: "Enviar notificação" },
];

function NiveisDeServico() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const entities = useEntityOptions();
  const canWrite = can("sla", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LooseRow | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("calendars").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const calendarOptions = (calendarsQuery.data ?? []).map((c) => ({
    value: c.id,
    label: String(c["name"]),
  }));

  const levelsQuery = useQuery({
    queryKey: ["escalation_levels", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("escalation_levels")
        .select("*")
        .eq("service_level_id", String(selected?.id))
        .order("offset_minutes");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const criteriaQuery = useQuery({
    queryKey: ["escalation_criteria", selectedLevel?.id],
    enabled: Boolean(selectedLevel),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("escalation_criteria")
        .select("*")
        .eq("level_id", String(selectedLevel?.id))
        .order("field");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["escalation_actions", selectedLevel?.id],
    enabled: Boolean(selectedLevel),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("escalation_actions")
        .select("*")
        .eq("level_id", String(selectedLevel?.id))
        .order("action_type");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [level, setLevel] = useState({ name: "", offset_minutes: -60 });
  const [criterion, setCriterion] = useState({ field: "status", value: "aberto" });
  const [action, setAction] = useState({
    action_type: "campo",
    field: "priority_level",
    value: "5",
  });

  const addLevel = useMutation({
    mutationFn: async () => {
      if (!level.name.trim()) throw new Error("Dê um nome ao nível.");
      const { error } = await looseDb.from("escalation_levels").insert({
        service_level_id: selected?.id,
        name: level.name.trim(),
        offset_minutes: Number(level.offset_minutes),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setLevel({ name: "", offset_minutes: -60 });
      queryClient.invalidateQueries({ queryKey: ["escalation_levels", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível criar", { description: e.message }),
  });

  const removeLevel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("escalation_levels").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSelectedLevel(null);
      queryClient.invalidateQueries({ queryKey: ["escalation_levels", selected?.id] });
    },
  });

  const addCriterion = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("escalation_criteria").insert({
        level_id: selectedLevel?.id,
        field: criterion.field,
        operator: "igual",
        value: criterion.value,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["escalation_criteria", selectedLevel?.id] }),
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeCriterion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("escalation_criteria").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["escalation_criteria", selectedLevel?.id] }),
  });

  const addAction = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("escalation_actions").insert({
        level_id: selectedLevel?.id,
        action_type: action.action_type,
        field: action.action_type === "campo" ? action.field : "",
        value: action.value,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["escalation_actions", selectedLevel?.id] }),
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("escalation_actions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["escalation_actions", selectedLevel?.id] }),
  });

  return (
    <AppShell
      title="Níveis de serviço"
      subtitle="SLA com o cliente, OLA entre times, e o que acontece quando o prazo se aproxima."
      breadcrumbTail="Níveis de serviço"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <div>
          <CrudTable
            table="service_levels"
            queryKey="service_levels"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={(row) => {
              setSelected(row);
              setSelectedLevel(null);
            }}
            emptyText="Nenhum nível de serviço cadastrado."
            defaults={{
              name: "",
              kind: "sla",
              target: "ttr",
              duration_value: 4,
              duration_unit: "hora",
              end_of_working_day: false,
              calendar_id: calendarOptions[0]?.value ?? "",
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "kind", label: "Tipo", type: "select", options: KINDS },
              { key: "target", label: "Alvo", type: "select", options: TARGETS },
              { key: "duration_value", label: "Prazo", type: "number" },
              { key: "duration_unit", label: "Unidade", type: "select", options: UNITS },
              {
                key: "calendar_id",
                label: "Calendário",
                type: "select",
                options: calendarOptions,
              },
              {
                key: "end_of_working_day",
                label: "Vence no fim do expediente",
                type: "boolean",
                formOnly: true,
              },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            O chamado em Pendente congela o prazo: ao voltar, o tempo parado é somado à data de
            vencimento.
          </p>
        </div>

        <div className="space-y-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">
              {selected ? `Escalonamento de ${selected["name"]}` : "Níveis de escalonamento"}
            </header>
            {!selected ? (
              <p className="p-4 text-xs text-muted-foreground">
                Escolha um nível de serviço na lista.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {(levelsQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-4 text-xs text-muted-foreground">
                      Nenhum nível. O prazo vence sem disparar nada.
                    </li>
                  )}
                  {(levelsQuery.data ?? []).map((l) => {
                    const offset = Number(l["offset_minutes"]);
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLevel(l)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                            l.id === selectedLevel?.id ? "bg-accent text-accent-foreground" : ""
                          }`}
                        >
                          <span className="flex-1 truncate font-medium">{String(l["name"])}</span>
                          <span className="text-muted-foreground">
                            {offset < 0
                              ? `${Math.abs(offset)} min antes`
                              : offset === 0
                                ? "no vencimento"
                                : `${offset} min depois`}
                          </span>
                          {canWrite && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label="Remover nível"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLevel.mutate(l.id);
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {canWrite && (
                  <div className="flex gap-2 border-t border-border p-2">
                    <Input
                      value={level.name}
                      onChange={(e) => setLevel({ ...level, name: e.target.value })}
                      placeholder="Nome do nível"
                      className="h-8 flex-1 text-xs"
                    />
                    <Input
                      type="number"
                      value={level.offset_minutes}
                      onChange={(e) =>
                        setLevel({ ...level, offset_minutes: Number(e.target.value) })
                      }
                      className="h-8 w-24 text-xs"
                      title="Minutos em relação ao vencimento; negativo dispara antes"
                    />
                    <Button size="sm" className="h-8" onClick={() => addLevel.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {selectedLevel && (
            <>
              <section className="panel overflow-hidden">
                <header className="panel-header">Critérios de disparo</header>
                <ul className="divide-y divide-border">
                  {(criteriaQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">
                      Sem critério: dispara sempre que o prazo chegar.
                    </li>
                  )}
                  {(criteriaQuery.data ?? []).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1">
                        {String(c["field"])} é {String(c["value"])}
                      </span>
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Remover critério"
                          onClick={() => removeCriterion.mutate(c.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {canWrite && (
                  <div className="flex gap-2 border-t border-border p-2">
                    <select
                      value={criterion.field}
                      onChange={(e) => setCriterion({ ...criterion, field: e.target.value })}
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="status">Status</option>
                      <option value="priority_level">Prioridade</option>
                      <option value="type">Tipo</option>
                    </select>
                    <select
                      value={criterion.value}
                      onChange={(e) => setCriterion({ ...criterion, value: e.target.value })}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                    >
                      {criterion.field === "status" &&
                        STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      {criterion.field === "priority_level" &&
                        [1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={String(p)}>
                            Nível {p}
                          </option>
                        ))}
                      {criterion.field === "type" && (
                        <>
                          <option value="incidente">Incidente</option>
                          <option value="requisicao">Requisição</option>
                        </>
                      )}
                    </select>
                    <Button size="sm" className="h-8" onClick={() => addCriterion.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </section>

              <section className="panel overflow-hidden">
                <header className="panel-header">Ações</header>
                <ul className="divide-y divide-border">
                  {(actionsQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">
                      Nenhuma ação configurada.
                    </li>
                  )}
                  {(actionsQuery.data ?? []).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1">
                        {a["action_type"] === "notificar"
                          ? "Enviar notificação"
                          : `Definir ${String(a["field"])} = ${String(a["value"])}`}
                      </span>
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Remover ação"
                          onClick={() => removeAction.mutate(a.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {canWrite && (
                  <div className="space-y-2 border-t border-border p-2">
                    <select
                      value={action.action_type}
                      onChange={(e) => setAction({ ...action, action_type: e.target.value })}
                      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    >
                      {ACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {action.action_type === "campo" && (
                      <div className="flex gap-2">
                        <select
                          value={action.field}
                          onChange={(e) => setAction({ ...action, field: e.target.value })}
                          className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                        >
                          <option value="priority_level">Prioridade</option>
                          <option value="status">Status</option>
                          <option value="urgency">Urgência</option>
                        </select>
                        <Input
                          value={action.value}
                          onChange={(e) => setAction({ ...action, value: e.target.value })}
                          className="h-8 w-24 text-xs"
                        />
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8" onClick={() => addAction.mutate()}>
                        <Plus className="size-3.5" /> Adicionar ação
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Label className="text-[0.7rem] text-muted-foreground">
          O escalonamento roda sozinho a cada 15 minutos.
        </Label>
      </div>
    </AppShell>
  );
}
