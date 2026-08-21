import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useTechnicianOptions } from "@/hooks/useTechnicianOptions";
import { LEVELS, levelLabel } from "@/lib/itil";

export const Route = createFileRoute("/_authenticated/assistencia/mudancas-recorrentes")({
  head: () => ({
    meta: [
      { title: "Mudanças recorrentes — Helpdesk T.I." },
      {
        name: "description",
        content: "Mudanças que o sistema abre sozinho numa periodicidade definida.",
      },
    ],
  }),
  component: MudancasRecorrentes,
});

/**
 * Periodicidades em minutos. Mudança costuma ser mais espaçada que chamado,
 * então o padrão começa no mês.
 */
const PERIODS = [
  { value: "10080", label: "Toda semana" },
  { value: "43200", label: "Todo mês" },
  { value: "129600", label: "A cada 3 meses" },
  { value: "259200", label: "A cada 6 meses" },
  { value: "525600", label: "Todo ano" },
];

const LEVEL_OPTIONS = LEVELS.map((l) => ({ value: String(l), label: levelLabel(l) }));

function MudancasRecorrentes() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const technicians = useTechnicianOptions();

  const categories = useQuery({
    queryKey: ["itil_categories"],
    queryFn: async () => {
      const { data } = await looseDb.from("itil_categories").select("*").order("path");
      return data ?? [];
    },
  });

  const categoryOptions = (categories.data ?? []).map((c) => ({
    value: c.id,
    label: String(c["name"]),
  }));

  return (
    <AppShell
      title="Mudanças recorrentes"
      subtitle="A manutenção que volta sempre: atualização trimestral, revisão de backup, troca de certificado."
      breadcrumbTail="Mudanças recorrentes"
    >
      <CrudTable
        table="recurrent_changes"
        queryKey="recurrent_changes"
        canWrite={can("change", "update")}
        emptyText="Nenhuma mudança programada."
        defaults={{
          name: "",
          title: "",
          description: "",
          category_id: "",
          urgency: 3,
          impact: 3,
          assignee_id: "",
          periodicity_minutes: 43200,
          anticipation_minutes: 0,
          is_active: true,
          entity_id: entities[0]?.value ?? "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Nome da programação", type: "text", required: true },
          { key: "title", label: "Título da mudança", type: "text", required: true },
          {
            key: "periodicity_minutes",
            label: "Periodicidade",
            type: "select",
            options: PERIODS,
          },
          {
            key: "category_id",
            label: "Categoria",
            type: "select",
            options: categoryOptions,
          },
          { key: "is_active", label: "Ativa", type: "boolean" },
          { key: "next_run_at", label: "Próxima criação", type: "datetime", readOnly: true },
          { key: "last_created_at", label: "Última criação", type: "datetime", readOnly: true },
          { key: "urgency", label: "Urgência", type: "select", options: LEVEL_OPTIONS, formOnly: true },
          { key: "impact", label: "Impacto", type: "select", options: LEVEL_OPTIONS, formOnly: true },
          {
            key: "assignee_id",
            label: "Responsável",
            type: "select",
            options: technicians,
            formOnly: true,
          },
          {
            key: "anticipation_minutes",
            label: "Criar com antecedência (min)",
            type: "number",
            formOnly: true,
          },
          { key: "start_date", label: "Início", type: "datetime", formOnly: true },
          { key: "end_date", label: "Fim (opcional)", type: "datetime", formOnly: true },
          {
            key: "entity_id",
            label: "Entidade",
            type: "select",
            options: entities,
            formOnly: true,
          },
          { key: "description", label: "Descrição da mudança", type: "textarea", formOnly: true },
          { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
        ]}
      />

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Quem cria as mudanças é a ação automática “Mudanças recorrentes”, que roda de hora em hora.
        Dá para forçar pela tela de ações automáticas.
      </p>
    </AppShell>
  );
}
