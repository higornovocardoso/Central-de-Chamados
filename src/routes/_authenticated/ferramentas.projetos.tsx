import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Gantt, type GanttTask } from "@/components/Gantt";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useTechnicians } from "@/hooks/useTechnicians";
import { LEVELS, levelLabel } from "@/lib/itil";

export const Route = createFileRoute("/_authenticated/ferramentas/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos" },
      {
        name: "description",
        content: "Projetos com tarefas, equipe, andamento e cronograma.",
      },
    ],
  }),
  component: Projetos,
});

const LEVEL_OPTIONS = LEVELS.map((l) => ({ value: String(l), label: levelLabel(l) }));

function Projetos() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const queryClient = useQueryClient();
  const techniciansQuery = useTechnicians();
  const canWrite = can("project", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [member, setMember] = useState("");

  const catalogQuery = useQuery({
    queryKey: ["project_catalog"],
    queryFn: async () => {
      const [states, types, taskTypes] = await Promise.all([
        looseDb.from("project_states").select("*").order("name"),
        looseDb.from("project_types").select("*").order("name"),
        looseDb.from("project_task_types").select("*").order("name"),
      ]);
      const asOptions = (rows: LooseRow[]) =>
        rows.map((r) => ({ value: r.id, label: String(r["name"]) }));
      return {
        states: asOptions(states.data ?? []),
        types: asOptions(types.data ?? []),
        taskTypes: asOptions(taskTypes.data ?? []),
      };
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      return data ?? [];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["project_tasks_gantt", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data } = await looseDb
        .from("project_tasks")
        .select("*")
        .eq("project_id", String(selected?.id))
        .order("planned_start");
      return data ?? [];
    },
  });

  const teamQuery = useQuery({
    queryKey: ["project_teams", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data } = await looseDb
        .from("project_teams")
        .select("*")
        .eq("project_id", String(selected?.id))
        .order("id");
      return data ?? [];
    },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("Escolha um integrante.");
      const { error } = await looseDb
        .from("project_teams")
        .insert({ project_id: selected?.id, user_id: member });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setMember("");
      queryClient.invalidateQueries({ queryKey: ["project_teams", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("project_teams").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project_teams", selected?.id] }),
  });

  const personName = (id: unknown) => {
    const found = (peopleQuery.data ?? []).find((p) => p.id === String(id));
    return found ? found.full_name || found.email : "Usuário";
  };

  const technicianOptions = (techniciansQuery.data ?? []).map((t) => ({
    value: t,
    label: personName(t),
  }));

  return (
    <AppShell
      title="Projetos"
      subtitle="A troca do servidor, a migração do sistema — o que não cabe num chamado."
      breadcrumbTail="Projetos"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
        <div>
          <CrudTable
            table="projects"
            queryKey="projects"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            emptyText="Nenhum projeto cadastrado."
            defaults={{
              name: "",
              code: "",
              state_id: "",
              project_type_id: "",
              priority_level: 3,
              start_date: "",
              end_date: "",
              entity_id: entities[0]?.value ?? "",
              description: "",
            }}
            fields={[
              { key: "name", label: "Projeto", type: "text", required: true },
              { key: "code", label: "Código", type: "text" },
              {
                key: "state_id",
                label: "Situação",
                type: "select",
                options: catalogQuery.data?.states ?? [],
              },
              {
                key: "percent_done",
                label: "Andamento",
                type: "number",
                readOnly: true,
                render: (row) => (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full bg-primary"
                        style={{ width: `${Number(row["percent_done"] ?? 0)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{Number(row["percent_done"] ?? 0)}%</span>
                  </span>
                ),
              },
              { key: "start_date", label: "Início", type: "date" },
              { key: "end_date", label: "Fim", type: "date" },
              {
                key: "project_type_id",
                label: "Tipo",
                type: "select",
                options: catalogQuery.data?.types ?? [],
                formOnly: true,
              },
              {
                key: "priority_level",
                label: "Prioridade",
                type: "select",
                options: LEVEL_OPTIONS,
                formOnly: true,
              },
              {
                key: "manager_id",
                label: "Gerente",
                type: "select",
                options: technicianOptions,
                formOnly: true,
              },
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
            O andamento do projeto é a média do andamento das suas tarefas — calculado no banco a
            cada alteração.
          </p>
        </div>

        <div>
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              Escolha um projeto para ver tarefas e equipe.
            </section>
          ) : (
            <Tabs defaultValue="tarefas">
              <TabsList className="min-h-8">
                <TabsTrigger value="tarefas" className="text-xs">
                  Tarefas
                </TabsTrigger>
                <TabsTrigger value="equipe" className="text-xs">
                  Equipe ({teamQuery.data?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="cronograma" className="text-xs">
                  Cronograma
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tarefas" className="mt-3">
                <CrudTable
                  table="project_tasks"
                  queryKey={"project_tasks_" + selected.id}
                  canWrite={canWrite}
                  emptyText="Nenhuma tarefa neste projeto."
                  defaults={{
                    project_id: selected.id,
                    name: "",
                    task_type_id: "",
                    state_id: "",
                    percent_done: 0,
                    planned_start: "",
                    planned_end: "",
                    planned_hours: 0,
                    description: "",
                  }}
                  fields={[
                    { key: "name", label: "Tarefa", type: "text", required: true },
                    {
                      key: "state_id",
                      label: "Situação",
                      type: "select",
                      options: catalogQuery.data?.states ?? [],
                    },
                    { key: "percent_done", label: "%", type: "number" },
                    { key: "planned_end", label: "Prazo", type: "date" },
                    {
                      key: "task_type_id",
                      label: "Tipo",
                      type: "select",
                      options: catalogQuery.data?.taskTypes ?? [],
                      formOnly: true,
                    },
                    { key: "planned_start", label: "Início", type: "date", formOnly: true },
                    { key: "planned_hours", label: "Horas previstas", type: "number", formOnly: true },
                    {
                      key: "assigned_user_id",
                      label: "Responsável",
                      type: "select",
                      options: technicianOptions,
                      formOnly: true,
                    },
                    { key: "description", label: "Descrição", type: "textarea", formOnly: true },
                  ]}
                />
              </TabsContent>

              <TabsContent value="cronograma" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Cronograma do projeto</header>
                  <Gantt
                    tasks={(tasksQuery.data ?? []).map<GanttTask>((t) => ({
                      id: t.id,
                      name: String(t["name"]),
                      start: t["planned_start"] ? String(t["planned_start"]) : null,
                      end: t["planned_end"] ? String(t["planned_end"]) : null,
                      percent: Number(t["percent_done"] ?? 0),
                    }))}
                  />
                </section>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  A barra fica vermelha quando o prazo passou e a tarefa não chegou a 100%.
                </p>
              </TabsContent>

              <TabsContent value="equipe" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Equipe do projeto</header>
                  <ul className="divide-y divide-border">
                    {(teamQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-4 text-xs text-muted-foreground">
                        Nenhum integrante.
                      </li>
                    )}
                    {(teamQuery.data ?? []).map((m) => (
                      <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="flex-1 truncate">{personName(m["user_id"])}</span>
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Remover da equipe"
                            onClick={() => removeMember.mutate(m.id)}
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
                        value={member}
                        onChange={(e) => setMember(e.target.value)}
                        className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Adicionar integrante</option>
                        {(peopleQuery.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" className="h-8" onClick={() => addMember.mutate()}>
                        <Plus className="size-3.5" />
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
