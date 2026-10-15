import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

export const Route = createFileRoute("/_authenticated/administracao/regras")({
  head: () => ({
    meta: [
      { title: "Regras de negócio" },
      {
        name: "description",
        content: "Regras que alteram o chamado automaticamente na abertura e na atualização.",
      },
    ],
  }),
  component: Regras,
});

/** Campos do chamado que a regra consegue olhar. */
const CRITERIA_FIELDS = [
  { value: "title", label: "Título" },
  { value: "description", label: "Descrição" },
  { value: "category", label: "Categoria (nome)" },
  { value: "status", label: "Status" },
  { value: "type", label: "Tipo" },
  { value: "urgency", label: "Urgência" },
  { value: "impact", label: "Impacto" },
  { value: "priority_level", label: "Prioridade" },
  { value: "reporter_email", label: "E-mail do solicitante" },
  { value: "reporter_sector", label: "Setor informado" },
];

const OPERATORS = [
  { value: "contem", label: "contém" },
  { value: "nao_contem", label: "não contém" },
  { value: "igual", label: "é" },
  { value: "diferente", label: "não é" },
  { value: "comeca_com", label: "começa com" },
  { value: "termina_com", label: "termina com" },
  { value: "regex", label: "casa com a expressão" },
  { value: "nao_regex", label: "não casa com a expressão" },
];

/** Campos que a regra consegue alterar. */
const ACTION_FIELDS = [
  { value: "status", label: "Status" },
  { value: "type", label: "Tipo" },
  { value: "urgency", label: "Urgência" },
  { value: "impact", label: "Impacto" },
  { value: "priority_level", label: "Prioridade" },
  { value: "category_id", label: "Categoria (id)" },
  { value: "assignee_id", label: "Atribuir ao técnico (id)" },
  { value: "recalcular_prioridade", label: "Recalcular a prioridade" },
];

const MATCH_MODES = [
  { value: "and", label: "E — todos os critérios" },
  { value: "or", label: "OU — qualquer critério" },
];

function Regras() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const entities = useEntityOptions();
  const canWrite = can("business_rule", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);

  const [criterion, setCriterion] = useState({ field: "title", operator: "contem", value: "" });
  const [action, setAction] = useState({ field: "urgency", value: "" });

  const criteriaQuery = useQuery({
    queryKey: ["rule_criteria", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("rule_criteria")
        .select("*")
        .eq("rule_id", String(selected?.id))
        .order("field");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["rule_actions", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("rule_actions")
        .select("*")
        .eq("rule_id", String(selected?.id))
        .order("field");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const addCriterion = useMutation({
    mutationFn: async () => {
      if (!criterion.value.trim()) throw new Error("Informe o valor do critério.");
      const { error } = await looseDb.from("rule_criteria").insert({
        rule_id: selected?.id,
        field: criterion.field,
        operator: criterion.operator,
        value: criterion.value.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setCriterion({ ...criterion, value: "" });
      queryClient.invalidateQueries({ queryKey: ["rule_criteria", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeCriterion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("rule_criteria").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rule_criteria", selected?.id] }),
  });

  const addAction = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("rule_actions").insert({
        rule_id: selected?.id,
        field: action.field,
        value: action.field === "recalcular_prioridade" ? "" : action.value.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setAction({ ...action, value: "" });
      queryClient.invalidateQueries({ queryKey: ["rule_actions", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("rule_actions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rule_actions", selected?.id] }),
  });

  const label = (list: { value: string; label: string }[], value: unknown) =>
    list.find((o) => o.value === String(value))?.label ?? String(value);

  return (
    <AppShell
      title="Regras de negócio"
      subtitle="Alteram o chamado sozinhas na abertura e na atualização, na ordem da coluna Ordem."
      breadcrumbTail="Regras"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <div>
          <CrudTable
            table="business_rules"
            queryKey="business_rules"
            orderBy="sort"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            emptyText="Nenhuma regra cadastrada."
            defaults={{
              name: "",
              entity_id: entities[0]?.value ?? "",
              is_active: true,
              match_mode: "and",
              run_on_add: true,
              run_on_update: false,
              sort: 100,
              description: "",
            }}
            fields={[
              { key: "sort", label: "Ordem", type: "number" },
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "match_mode", label: "Combinação", type: "select", options: MATCH_MODES },
              { key: "run_on_add", label: "Na abertura", type: "boolean" },
              { key: "run_on_update", label: "Na atualização", type: "boolean" },
              { key: "is_active", label: "Ativa", type: "boolean" },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "description", label: "Descrição", type: "textarea", formOnly: true },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            As regras rodam em sequência e o resultado de uma entra na avaliação da próxima. Se
            alterar urgência ou impacto, adicione também a ação "Recalcular a prioridade".
          </p>
        </div>

        <div className="space-y-3">
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              Escolha uma regra na lista para configurar critérios e ações.
            </section>
          ) : (
            <>
              <section className="panel overflow-hidden">
                <header className="panel-header">Critérios de {String(selected["name"])}</header>
                <ul className="divide-y divide-border">
                  {(criteriaQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">
                      Sem critério, a regra nunca dispara.
                    </li>
                  )}
                  {(criteriaQuery.data ?? []).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1">
                        <strong>{label(CRITERIA_FIELDS, c["field"])}</strong>{" "}
                        {label(OPERATORS, c["operator"])}{" "}
                        <span className="font-mono">{String(c["value"])}</span>
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
                  <div className="space-y-2 border-t border-border p-2">
                    <div className="flex gap-2">
                      <select
                        value={criterion.field}
                        onChange={(e) => setCriterion({ ...criterion, field: e.target.value })}
                        className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        {CRITERIA_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={criterion.operator}
                        onChange={(e) => setCriterion({ ...criterion, operator: e.target.value })}
                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        {OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={criterion.value}
                        onChange={(e) => setCriterion({ ...criterion, value: e.target.value })}
                        placeholder="valor"
                        className="h-8 flex-1 text-xs"
                      />
                      <Button size="sm" className="h-8" onClick={() => addCriterion.mutate()}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="panel overflow-hidden">
                <header className="panel-header">Ações</header>
                <ul className="divide-y divide-border">
                  {(actionsQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">
                      Nenhuma ação: a regra não muda nada.
                    </li>
                  )}
                  {(actionsQuery.data ?? []).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1">
                        {a["field"] === "recalcular_prioridade" ? (
                          "Recalcular a prioridade"
                        ) : (
                          <>
                            Definir <strong>{label(ACTION_FIELDS, a["field"])}</strong> ={" "}
                            <span className="font-mono">{String(a["value"])}</span>
                          </>
                        )}
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
                      value={action.field}
                      onChange={(e) => setAction({ ...action, field: e.target.value })}
                      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    >
                      {ACTION_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      {action.field !== "recalcular_prioridade" && (
                        <Input
                          value={action.value}
                          onChange={(e) => setAction({ ...action, value: e.target.value })}
                          placeholder="valor"
                          className="h-8 flex-1 text-xs"
                        />
                      )}
                      <Button size="sm" className="ml-auto h-8" onClick={() => addAction.mutate()}>
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
    </AppShell>
  );
}
