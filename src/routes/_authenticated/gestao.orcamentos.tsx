import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { formatMoneyBR } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/gestao/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Helpdesk T.I." },
      {
        name: "description",
        content: "Verba por período, com o consumo vindo dos custos de chamado e das compras.",
      },
    ],
  }),
  component: Orcamentos,
});

function Orcamentos() {
  const { can } = usePermissions();
  const entities = useEntityOptions();

  // O consumo vem de duas fontes, como no GLPI: custo de chamado e compra de ativo.
  const spentQuery = useQuery({
    queryKey: ["budget_spent"],
    queryFn: async () => {
      const [costs, infocoms] = await Promise.all([
        looseDb.from("ticket_costs").select("*").order("id"),
        looseDb.from("asset_infocoms").select("*").order("id"),
      ]);

      const spent = new Map<string, number>();
      for (const c of costs.data ?? []) {
        const budget = c["budget_id"];
        if (!budget) continue;
        const total =
          Number(c["cost_time"] ?? 0) +
          Number(c["cost_fixed"] ?? 0) +
          Number(c["cost_material"] ?? 0);
        spent.set(String(budget), (spent.get(String(budget)) ?? 0) + total);
      }
      for (const i of infocoms.data ?? []) {
        const budget = i["budget_id"];
        if (!budget) continue;
        spent.set(String(budget), (spent.get(String(budget)) ?? 0) + Number(i["value"] ?? 0));
      }
      return spent;
    },
  });

  const usage = (row: LooseRow) => {
    const total = Number(row["value"] ?? 0);
    const used = spentQuery.data?.get(row.id) ?? 0;
    const over = total > 0 && used > total;
    return (
      <Tag
        className={
          over
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-border bg-secondary text-muted-foreground"
        }
      >
        {formatMoneyBR(used)} usados
      </Tag>
    );
  };

  return (
    <AppShell
      title="Orçamentos"
      subtitle="Quanto foi separado, e quanto já saiu."
      breadcrumbTail="Orçamentos"
    >
      <CrudTable
        table="budgets"
        queryKey="budgets"
        canWrite={can("budget", "update")}
        emptyText="Nenhum orçamento cadastrado."
        defaults={{
          name: "",
          value: 0,
          start_date: "",
          end_date: "",
          entity_id: entities[0]?.value ?? "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Orçamento", type: "text", required: true },
          {
            key: "value",
            label: "Valor",
            type: "number",
            render: (row) => formatMoneyBR(row["value"] as number),
          },
          { key: "id", label: "Consumido", type: "text", readOnly: true, render: usage },
          { key: "start_date", label: "De", type: "date" },
          { key: "end_date", label: "Até", type: "date" },
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
        O consumo soma os custos lançados nos chamados e o valor de compra dos ativos que apontam
        para este orçamento.
      </p>
    </AppShell>
  );
}
