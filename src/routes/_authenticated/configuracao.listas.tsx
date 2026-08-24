import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CrudTable, type CrudField } from "@/components/CrudTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { ASSET_KINDS, ASSET_KIND_LABEL } from "@/lib/glpi";
import { COMPONENT_KINDS, COMPONENT_KIND_LABEL } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/configuracao/listas")({
  head: () => ({
    meta: [
      { title: "Listas suspensas" },
      {
        name: "description",
        content: "Fabricantes, modelos, tipos, estados, componentes, VLANs e redes.",
      },
    ],
  }),
  component: Listas,
});

const KIND_OPTIONS = ASSET_KINDS.map((k) => ({ value: k, label: ASSET_KIND_LABEL[k] }));
const COMPONENT_OPTIONS = COMPONENT_KINDS.map((k) => ({
  value: k,
  label: COMPONENT_KIND_LABEL[k],
}));

function Listas() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("dropdown", "update");

  const supportQuery = useQuery({
    queryKey: ["dropdown_support"],
    queryFn: async () => {
      const [manufacturers, vlans, locations] = await Promise.all([
        looseDb.from("manufacturers").select("*").order("name"),
        looseDb.from("vlans").select("*").order("name"),
        looseDb.from("locations").select("*").order("name"),
      ]);
      return {
        manufacturers: manufacturers.data ?? [],
        vlans: vlans.data ?? [],
        locations: locations.data ?? [],
      };
    },
  });

  const asOptions = (rows: LooseRow[]) =>
    rows.map((r) => ({ value: r.id, label: String(r["name"]) }));

  const manufacturerOptions = asOptions(supportQuery.data?.manufacturers ?? []);

  /** Cada aba é um cadastro simples; a diferença está só nos campos. */
  const TABS: {
    key: string;
    label: string;
    table: string;
    fields: CrudField[];
    defaults: Record<string, unknown>;
    orderBy?: string;
  }[] = [
    {
      key: "fabricantes",
      label: "Fabricantes",
      table: "manufacturers",
      defaults: { name: "", comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "comment", label: "Comentário", type: "text" },
      ],
    },
    {
      key: "modelos",
      label: "Modelos",
      table: "asset_models",
      defaults: { name: "", kind: "computador", manufacturer_id: "", product_number: "" },
      fields: [
        { key: "name", label: "Modelo", type: "text", required: true },
        { key: "kind", label: "Tipo de ativo", type: "select", options: KIND_OPTIONS },
        {
          key: "manufacturer_id",
          label: "Fabricante",
          type: "select",
          options: manufacturerOptions,
        },
        { key: "product_number", label: "Código do produto", type: "text" },
      ],
    },
    {
      key: "tipos",
      label: "Tipos",
      table: "asset_types",
      defaults: { name: "", kind: "computador", comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "kind", label: "Aplica-se a", type: "select", options: KIND_OPTIONS },
        { key: "comment", label: "Comentário", type: "text", formOnly: true },
      ],
    },
    {
      key: "estados",
      label: "Estados",
      table: "asset_states",
      defaults: { name: "", is_visible_inventory: true, comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "is_visible_inventory", label: "Visível no inventário", type: "boolean" },
        { key: "comment", label: "Comentário", type: "text", formOnly: true },
      ],
    },
    {
      key: "componentes",
      label: "Componentes",
      table: "components",
      defaults: { name: "", kind: "memoria", manufacturer_id: "", specification: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "kind", label: "Categoria", type: "select", options: COMPONENT_OPTIONS },
        {
          key: "manufacturer_id",
          label: "Fabricante",
          type: "select",
          options: manufacturerOptions,
        },
        { key: "specification", label: "Especificação", type: "text" },
      ],
    },
    {
      key: "sistemas",
      label: "Sistemas operacionais",
      table: "operating_systems",
      defaults: { name: "", comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "comment", label: "Comentário", type: "text" },
      ],
    },
    {
      key: "categorias-software",
      label: "Categorias de software",
      table: "software_categories",
      defaults: { name: "", comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "comment", label: "Comentário", type: "text" },
      ],
    },
    {
      key: "vlans",
      label: "VLANs",
      table: "vlans",
      defaults: { name: "", tag: 0, entity_id: entities[0]?.value ?? "", comment: "" },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "tag", label: "Tag", type: "number" },
        { key: "comment", label: "Comentário", type: "text" },
        {
          key: "entity_id",
          label: "Entidade",
          type: "select",
          options: entities,
          formOnly: true,
        },
      ],
    },
    {
      key: "redes",
      label: "Redes IP",
      table: "ip_networks",
      defaults: {
        name: "",
        address: "",
        netmask: "",
        gateway: "",
        vlan_id: "",
        entity_id: entities[0]?.value ?? "",
      },
      fields: [
        { key: "name", label: "Nome", type: "text", required: true },
        { key: "address", label: "Endereço", type: "text" },
        { key: "netmask", label: "Máscara", type: "text" },
        { key: "gateway", label: "Gateway", type: "text" },
        {
          key: "vlan_id",
          label: "VLAN",
          type: "select",
          options: asOptions(supportQuery.data?.vlans ?? []),
          formOnly: true,
        },
        {
          key: "entity_id",
          label: "Entidade",
          type: "select",
          options: entities,
          formOnly: true,
        },
      ],
    },
    {
      key: "tomadas",
      label: "Tomadas de rede",
      table: "sockets",
      defaults: { name: "", location_id: "", comment: "" },
      fields: [
        { key: "name", label: "Identificação", type: "text", required: true },
        {
          key: "location_id",
          label: "Local",
          type: "select",
          options: asOptions(supportQuery.data?.locations ?? []),
        },
        { key: "comment", label: "Comentário", type: "text" },
      ],
    },
  ];

  return (
    <AppShell
      title="Listas suspensas"
      subtitle="Os cadastros de apoio que alimentam o inventário inteiro."
      breadcrumbTail="Listas suspensas"
    >
      <Tabs defaultValue="fabricantes">
        <TabsList className="min-h-8">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-3">
            <CrudTable
              table={t.table}
              queryKey={t.table}
              orderBy={t.orderBy ?? "name"}
              canWrite={canWrite}
              defaults={t.defaults}
              fields={t.fields}
              emptyText={`Nenhum registro em ${t.label.toLowerCase()}.`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
