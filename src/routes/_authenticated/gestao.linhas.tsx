import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";
import { formatMoneyBR } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/gestao/linhas")({
  head: () => ({
    meta: [
      { title: "Linhas telefônicas — Helpdesk T.I." },
      {
        name: "description",
        content: "Linhas móveis, fixas e de dados, com operadora e valor mensal.",
      },
    ],
  }),
  component: Linhas,
});

function Linhas() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();

  return (
    <AppShell
      title="Linhas telefônicas"
      subtitle="Cada linha com sua operadora, seu valor e o aparelho onde está."
      breadcrumbTail="Linhas telefônicas"
    >
      <CrudTable
        table="phone_lines"
        queryKey="phone_lines"
        canWrite={can("line", "update")}
        emptyText="Nenhuma linha cadastrada."
        defaults={{
          name: "",
          number: "",
          line_type_id: "",
          supplier_id: "",
          state_id: "",
          monthly_value: 0,
          entity_id: entities[0]?.value ?? "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Linha", type: "text", required: true },
          { key: "number", label: "Número", type: "text" },
          { key: "line_type_id", label: "Tipo", type: "select", options: options.lineTypes },
          { key: "supplier_id", label: "Operadora", type: "select", options: options.suppliers },
          {
            key: "monthly_value",
            label: "Mensalidade",
            type: "number",
            render: (row) => formatMoneyBR(row["monthly_value"] as number),
          },
          { key: "state_id", label: "Situação", type: "select", options: options.states },
          { key: "caller_name", label: "Nome do titular", type: "text", formOnly: true },
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
    </AppShell>
  );
}
