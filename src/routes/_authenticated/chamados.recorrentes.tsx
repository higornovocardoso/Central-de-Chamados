import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { LEVELS, levelLabel } from "@/lib/itil";

export const Route = createFileRoute("/_authenticated/chamados/recorrentes")({
  head: () => ({
    meta: [
      { title: "Chamados recorrentes — Helpdesk T.I." },
      {
        name: "description",
        content: "Chamados que o sistema abre sozinho em uma periodicidade definida.",
      },
    ],
  }),
  component: Recorrentes,
});

const TYPES = [
  { value: "incidente", label: "Incidente" },
  { value: "requisicao", label: "Requisição" },
];

/** Periodicidades em minutos, nos intervalos que aparecem na prática. */
const PERIODS = [
  { value: "1440", label: "Todo dia" },
  { value: "10080", label: "Toda semana" },
  { value: "20160", label: "A cada 15 dias" },
  { value: "43200", label: "Todo mês" },
  { value: "129600", label: "A cada 3 meses" },
  { value: "525600", label: "Todo ano" },
];

const LEVEL_OPTIONS = LEVELS.map((l) => ({ value: String(l), label: levelLabel(l) }));

function Recorrentes() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("recurrent", "update");

  const categoriesQuery = useQuery({
    queryKey: ["itil_categories_options"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("itil_categories").select("*").order("path");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({
    value: c.id,
    label: String(c["name"]),
  }));

  return (
    <AppShell
      title="Chamados recorrentes"
      subtitle="Para o que se repete: conferir backup toda segunda, fechar o mês, revisar acessos."
      breadcrumbTail="Chamados recorrentes"
    >
      <CrudTable
        table="recurrent_tickets"
        queryKey="recurrent_tickets"
        canWrite={canWrite}
        emptyText="Nenhum chamado recorrente programado."
        defaults={{
          name: "",
          title: "",
          description: "",
          type: "incidente",
          category_id: categoryOptions[0]?.value ?? "",
          urgency: 3,
          impact: 3,
          periodicity_minutes: 10080,
          anticipation_minutes: 0,
          entity_id: entities[0]?.value ?? "",
          is_active: true,
        }}
        fields={[
          { key: "name", label: "Nome da programação", type: "text", required: true },
          { key: "title", label: "Título do chamado", type: "text", required: true },
          {
            key: "periodicity_minutes",
            label: "Periodicidade",
            type: "select",
            options: PERIODS,
          },
          { key: "type", label: "Tipo", type: "select", options: TYPES },
          {
            key: "category_id",
            label: "Categoria",
            type: "select",
            options: categoryOptions,
          },
          { key: "urgency", label: "Urgência", type: "select", options: LEVEL_OPTIONS },
          { key: "is_active", label: "Ativo", type: "boolean" },
          { key: "next_run_at", label: "Próxima criação", type: "datetime", readOnly: true },
          { key: "last_created_at", label: "Última criação", type: "datetime", readOnly: true },
          { key: "impact", label: "Impacto", type: "select", options: LEVEL_OPTIONS, formOnly: true },
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
          { key: "description", label: "Descrição do chamado", type: "textarea", formOnly: true },
        ]}
      />

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        A criação é feita pela ação automática "Chamados recorrentes", em Configurar › Ações
        automáticas — de onde também dá para forçar a execução na hora.
      </p>
    </AppShell>
  );
}
