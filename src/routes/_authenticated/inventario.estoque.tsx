import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

export const Route = createFileRoute("/_authenticated/inventario/estoque")({
  // O menu do GLPI lista estes objetos separadamente; aqui eles
  // dividem a mesma tela, então a aba vem pela URL.
  validateSearch: (search: Record<string, unknown>): { aba: "cartuchos" | "consumiveis" } => {
    const aba = String(search["aba"] ?? "");
    return { aba: (["cartuchos", "consumiveis"] as const).includes(aba as never)
      ? (aba as "cartuchos" | "consumiveis")
      : "cartuchos" };
  },
  head: () => ({
    meta: [
      { title: "Cartuchos e consumíveis" },
      {
        name: "description",
        content: "Estoque de cartuchos e consumíveis, com alerta de nível mínimo.",
      },
    ],
  }),
  component: Estoque,
});

function Estoque() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("cartridge", "update") || can("consumable", "update");

  const manufacturersQuery = useQuery({
    queryKey: ["manufacturers"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("manufacturers").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const cartridgesQuery = useQuery({
    queryKey: ["cartridges_all"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("cartridges").select("*").order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const consumablesQuery = useQuery({
    queryKey: ["consumables_all"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("consumables").select("*").order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const manufacturerOptions = (manufacturersQuery.data ?? []).map((m) => ({
    value: m.id,
    label: String(m["name"]),
  }));

  /** Em estoque é o que entrou e ainda não saiu nem foi instalado. */
  const cartridgeStock = (itemId: string) =>
    (cartridgesQuery.data ?? []).filter(
      (c) => c["cartridge_item_id"] === itemId && !c["date_out"] && !c["date_use"],
    ).length;

  const consumableStock = (itemId: string) =>
    (consumablesQuery.data ?? []).filter(
      (c) => c["consumable_item_id"] === itemId && !c["date_out"],
    ).length;

  const stockCell = (row: LooseRow, stock: number) => {
    const threshold = Number(row["alarm_threshold"] ?? 0);
    const low = stock <= threshold;
    return (
      <Tag
        className={
          low
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-success/30 bg-success/15 text-success"
        }
      >
        {low && <AlertTriangle className="mr-1 inline size-3" />}
        {stock} em estoque
      </Tag>
    );
  };

  return (
    <AppShell
      title="Cartuchos e consumíveis"
      subtitle="Quanto ainda tem, e quando pedir mais."
      breadcrumbTail="Estoque"
    >
      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
        <TabsList className="min-h-8">
          <TabsTrigger value="cartuchos" className="text-xs">
            Cartuchos
          </TabsTrigger>
          <TabsTrigger value="consumiveis" className="text-xs">
            Consumíveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cartuchos" className="mt-3">
          <CrudTable
            table="cartridge_items"
            queryKey="cartridge_items"
            canWrite={canWrite}
            emptyText="Nenhum modelo de cartucho cadastrado."
            defaults={{
              name: "",
              reference: "",
              manufacturer_id: "",
              alarm_threshold: 3,
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Cartucho", type: "text", required: true },
              { key: "reference", label: "Referência", type: "text" },
              {
                key: "manufacturer_id",
                label: "Fabricante",
                type: "select",
                options: manufacturerOptions,
              },
              { key: "alarm_threshold", label: "Alerta abaixo de", type: "number" },
              {
                key: "id",
                label: "Estoque",
                type: "text",
                readOnly: true,
                render: (row) => stockCell(row, cartridgeStock(row.id)),
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
            Cada unidade comprada entra como um registro em <code>cartridges</code>, com data de
            entrada; ao instalar numa impressora, a data de uso é preenchida e a unidade sai do
            estoque.
          </p>
        </TabsContent>

        <TabsContent value="consumiveis" className="mt-3">
          <CrudTable
            table="consumable_items"
            queryKey="consumable_items"
            canWrite={canWrite}
            emptyText="Nenhum consumível cadastrado."
            defaults={{
              name: "",
              reference: "",
              manufacturer_id: "",
              alarm_threshold: 5,
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Consumível", type: "text", required: true },
              { key: "reference", label: "Referência", type: "text" },
              {
                key: "manufacturer_id",
                label: "Fabricante",
                type: "select",
                options: manufacturerOptions,
              },
              { key: "alarm_threshold", label: "Alerta abaixo de", type: "number" },
              {
                key: "id",
                label: "Estoque",
                type: "text",
                readOnly: true,
                render: (row) => stockCell(row, consumableStock(row.id)),
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
            A ação automática "Alertas de inventário" varre os dois estoques uma vez por dia e
            conta quantos itens estão no limite.
          </p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
