import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { formatDay } from "@/lib/glpi";

export const Route = createFileRoute("/_authenticated/inventario/softwares")({
  // O menu do GLPI lista estes objetos separadamente; aqui eles
  // dividem a mesma tela, então a aba vem pela URL.
  validateSearch: (search: Record<string, unknown>): { aba: "versoes" | "licencas" } => {
    const aba = String(search["aba"] ?? "");
    return {
      aba: (["versoes", "licencas"] as const).includes(aba as never)
        ? (aba as "versoes" | "licencas")
        : "versoes",
    };
  },
  head: () => ({
    meta: [
      { title: "Softwares" },
      {
        name: "description",
        content: "Softwares, versões, licenças e onde cada licença está instalada.",
      },
    ],
  }),
  component: Softwares,
});

function Softwares() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("software", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["software_catalog"],
    queryFn: async () => {
      const [manufacturers, categories, os] = await Promise.all([
        looseDb.from("manufacturers").select("*").order("name"),
        looseDb.from("software_categories").select("*").order("name"),
        looseDb.from("operating_systems").select("*").order("name"),
      ]);
      return {
        manufacturers: manufacturers.data ?? [],
        categories: categories.data ?? [],
        operatingSystems: os.data ?? [],
      };
    },
  });

  const options = (rows: LooseRow[]) =>
    rows.map((r) => ({ value: r.id, label: String(r["name"]) }));

  const versionsQuery = useQuery({
    queryKey: ["software_versions", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("software_versions")
        .select("*")
        .eq("software_id", String(selected?.id))
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const licensesQuery = useQuery({
    queryKey: ["software_licenses", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("software_licenses")
        .select("*")
        .eq("software_id", String(selected?.id))
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const installsQuery = useQuery({
    queryKey: ["software_installs_all"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("software_installations").select("*").order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const usageOf = (licenseId: string) =>
    (installsQuery.data ?? []).filter((i) => i["license_id"] === licenseId).length;

  const versionOptions = (versionsQuery.data ?? []).map((v) => ({
    value: v.id,
    label: String(v["name"]),
  }));

  return (
    <AppShell
      title="Softwares"
      subtitle="Cada software tem versões; cada licença tem uma quantidade e é consumida pelas instalações."
      breadcrumbTail="Softwares"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
        <CrudTable
          table="software"
          queryKey="software"
          canWrite={canWrite}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          emptyText="Nenhum software cadastrado."
          defaults={{
            name: "",
            manufacturer_id: "",
            category_id: "",
            entity_id: entities[0]?.value ?? "",
            is_helpdesk_visible: true,
            comment: "",
          }}
          fields={[
            { key: "name", label: "Nome", type: "text", required: true },
            {
              key: "manufacturer_id",
              label: "Fabricante",
              type: "select",
              options: options(catalogQuery.data?.manufacturers ?? []),
            },
            {
              key: "category_id",
              label: "Categoria",
              type: "select",
              options: options(catalogQuery.data?.categories ?? []),
            },
            { key: "is_helpdesk_visible", label: "Visível no chamado", type: "boolean" },
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

        <div className="space-y-3">
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              Escolha um software para ver versões e licenças.
            </section>
          ) : (
            <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
              <TabsList className="min-h-8">
                <TabsTrigger value="versoes" className="text-xs">
                  Versões ({versionsQuery.data?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="licencas" className="text-xs">
                  Licenças ({licensesQuery.data?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="versoes" className="mt-3">
                <CrudTable
                  table="software_versions"
                  queryKey={`software_versions_${selected.id}`}
                  canWrite={canWrite}
                  emptyText="Nenhuma versão cadastrada."
                  defaults={{ software_id: selected.id, name: "", os_id: "", comment: "" }}
                  fields={[
                    { key: "name", label: "Versão", type: "text", required: true },
                    {
                      key: "os_id",
                      label: "Sistema operacional",
                      type: "select",
                      options: options(catalogQuery.data?.operatingSystems ?? []),
                    },
                    { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
                  ]}
                />
              </TabsContent>

              <TabsContent value="licencas" className="mt-3">
                <CrudTable
                  table="software_licenses"
                  queryKey={`software_licenses_${selected.id}`}
                  canWrite={canWrite}
                  emptyText="Nenhuma licença cadastrada."
                  defaults={{
                    software_id: selected.id,
                    name: "",
                    license_type: "",
                    serial_number: "",
                    quantity: 1,
                    allow_overquota: false,
                    entity_id: entities[0]?.value ?? "",
                  }}
                  fields={[
                    { key: "name", label: "Licença", type: "text", required: true },
                    { key: "quantity", label: "Quantidade", type: "number" },
                    {
                      key: "version_use_id",
                      label: "Versão em uso",
                      type: "select",
                      options: versionOptions,
                    },
                    { key: "expire_date", label: "Validade", type: "date" },
                    { key: "license_type", label: "Tipo", type: "text", formOnly: true },
                    {
                      key: "serial_number",
                      label: "Número de série",
                      type: "text",
                      formOnly: true,
                    },
                    {
                      key: "allow_overquota",
                      label: "Permite estouro de cota",
                      type: "boolean",
                      formOnly: true,
                    },
                    {
                      key: "version_buy_id",
                      label: "Versão comprada",
                      type: "select",
                      options: versionOptions,
                      formOnly: true,
                    },
                    {
                      key: "entity_id",
                      label: "Entidade",
                      type: "select",
                      options: entities,
                      formOnly: true,
                    },
                  ]}
                />

                <section className="panel mt-3 overflow-hidden">
                  <header className="panel-header">Uso das licenças</header>
                  <ul className="divide-y divide-border">
                    {(licensesQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-4 text-xs text-muted-foreground">
                        Nenhuma licença para acompanhar.
                      </li>
                    )}
                    {(licensesQuery.data ?? []).map((l) => {
                      const quantity = Number(l["quantity"] ?? 0);
                      const used = usageOf(l.id);
                      const over = quantity > 0 && used > quantity;
                      return (
                        <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <span className="flex-1 truncate font-medium">{String(l["name"])}</span>
                          {Boolean(l["expire_date"]) && (
                            <span className="text-muted-foreground">
                              vence {formatDay(String(l["expire_date"]))}
                            </span>
                          )}
                          <Tag
                            className={
                              over
                                ? "border-destructive/40 bg-destructive/15 text-destructive"
                                : "border-border bg-secondary text-muted-foreground"
                            }
                          >
                            {used} de {quantity === 0 ? "∞" : quantity}
                          </Tag>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AppShell>
  );
}
