import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";
import { formatBytes } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/gestao/infra")({
  // O menu do GLPI lista estes objetos separadamente; aqui eles
  // dividem a mesma tela, então a aba vem pela URL.
  validateSearch: (
    search: Record<string, unknown>,
  ): { aba: "datacenters" | "salas" | "clusters" | "appliances" | "bancos" } => {
    const aba = String(search["aba"] ?? "");
    return {
      aba: (["datacenters", "salas", "clusters", "appliances", "bancos"] as const).includes(
        aba as never,
      )
        ? (aba as "datacenters" | "salas" | "clusters" | "appliances" | "bancos")
        : "datacenters",
    };
  },
  head: () => ({
    meta: [
      { title: "Infraestrutura" },
      {
        name: "description",
        content: "Datacenters, salas, clusters, appliances e bancos de dados.",
      },
    ],
  }),
  component: Infra,
});

function Infra() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();
  const [instance, setInstance] = useState<LooseRow | null>(null);

  const assetsQuery = useQuery({
    queryKey: ["assets_options"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id,name,asset_tag").order("name");
      return data ?? [];
    },
  });

  const instancesQuery = useQuery({
    queryKey: ["database_instances"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("database_instances").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const assetOptions = (assetsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const instanceOptions = (instancesQuery.data ?? []).map((i) => ({
    value: i.id,
    label: String(i["name"]),
  }));

  const roomsQuery = useQuery({
    queryKey: ["server_rooms"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("server_rooms").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <AppShell
      title="Infraestrutura"
      subtitle="Onde as coisas ficam e como se agrupam: datacenter, sala, cluster, aplicação e banco."
      breadcrumbTail="Infraestrutura"
    >
      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
        <TabsList className="min-h-8">
          <TabsTrigger value="datacenters" className="text-xs">
            Datacenters
          </TabsTrigger>
          <TabsTrigger value="salas" className="text-xs">
            Salas de servidores
          </TabsTrigger>
          <TabsTrigger value="clusters" className="text-xs">
            Clusters
          </TabsTrigger>
          <TabsTrigger value="appliances" className="text-xs">
            Appliances
          </TabsTrigger>
          <TabsTrigger value="bancos" className="text-xs">
            Bancos de dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datacenters" className="mt-3">
          <CrudTable
            table="datacenters"
            queryKey="datacenters"
            canWrite={can("datacenter", "update")}
            emptyText="Nenhum datacenter cadastrado."
            defaults={{ name: "", entity_id: entities[0]?.value ?? "", comment: "" }}
            fields={[
              { key: "name", label: "Datacenter", type: "text", required: true },
              { key: "comment", label: "Comentário", type: "text" },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="salas" className="mt-3">
          <CrudTable
            table="server_rooms"
            queryKey="server_rooms"
            canWrite={can("datacenter", "update")}
            emptyText="Nenhuma sala cadastrada."
            defaults={{
              name: "",
              datacenter_id: options.datacenters[0]?.value ?? "",
              rows_count: 0,
              columns_count: 0,
              comment: "",
            }}
            fields={[
              { key: "name", label: "Sala", type: "text", required: true },
              {
                key: "datacenter_id",
                label: "Datacenter",
                type: "select",
                options: options.datacenters,
              },
              { key: "rows_count", label: "Fileiras", type: "number" },
              { key: "columns_count", label: "Colunas", type: "number" },
              { key: "comment", label: "Comentário", type: "text", formOnly: true },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Os racks cadastrados no inventário apontam para a sala pelo campo{" "}
            <code>server_room_id</code>.
          </p>
        </TabsContent>

        <TabsContent value="clusters" className="mt-3">
          <CrudTable
            table="clusters"
            queryKey="clusters"
            canWrite={can("cluster", "update")}
            emptyText="Nenhum cluster cadastrado."
            defaults={{
              name: "",
              cluster_uuid: "",
              version: "",
              cluster_type: "",
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Cluster", type: "text", required: true },
              { key: "cluster_type", label: "Tipo", type: "text" },
              { key: "version", label: "Versão", type: "text" },
              { key: "cluster_uuid", label: "UUID", type: "text", formOnly: true },
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
        </TabsContent>

        <TabsContent value="appliances" className="mt-3">
          <CrudTable
            table="appliances"
            queryKey="appliances"
            canWrite={can("appliance", "update")}
            emptyText="Nenhuma aplicação cadastrada."
            defaults={{
              name: "",
              appliance_type_id: "",
              environment_id: "",
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Aplicação", type: "text", required: true },
              {
                key: "appliance_type_id",
                label: "Tipo",
                type: "select",
                options: options.applianceTypes,
              },
              {
                key: "environment_id",
                label: "Ambiente",
                type: "select",
                options: options.environments,
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
            Appliance é a aplicação de negócio — o sistema contábil, o fiscal, a integração com o
            banco. Serve para saber o que para quando um servidor cai.
          </p>
        </TabsContent>

        <TabsContent value="bancos" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
            <div>
              <h2 className="mb-2 text-xs font-semibold">Instâncias</h2>
              <CrudTable
                table="database_instances"
                queryKey="database_instances"
                canWrite={can("database", "update")}
                selectedId={instance?.id ?? null}
                onSelect={setInstance}
                emptyText="Nenhuma instância cadastrada."
                defaults={{
                  name: "",
                  version: "",
                  port: 5432,
                  asset_id: "",
                  is_active: true,
                  entity_id: entities[0]?.value ?? "",
                  comment: "",
                }}
                fields={[
                  { key: "name", label: "Instância", type: "text", required: true },
                  { key: "version", label: "Versão", type: "text" },
                  { key: "port", label: "Porta", type: "number" },
                  { key: "asset_id", label: "Servidor", type: "select", options: assetOptions },
                  { key: "is_active", label: "Ativa", type: "boolean" },
                  { key: "install_path", label: "Caminho", type: "text", formOnly: true },
                  {
                    key: "entity_id",
                    label: "Entidade",
                    type: "select",
                    options: entities,
                    formOnly: true,
                  },
                ]}
              />
            </div>

            <div>
              {!instance ? (
                <section className="panel p-6 text-center text-xs text-muted-foreground">
                  Escolha uma instância para ver os bancos.
                </section>
              ) : (
                <>
                  <h2 className="mb-2 text-xs font-semibold">
                    Bancos de {String(instance["name"])}
                  </h2>
                  <CrudTable
                    table="databases"
                    queryKey={"databases_" + instance.id}
                    canWrite={can("database", "update")}
                    emptyText="Nenhum banco cadastrado."
                    defaults={{
                      instance_id: instance.id,
                      name: "",
                      size_mb: 0,
                      is_active: true,
                      is_on_backup: true,
                    }}
                    fields={[
                      { key: "name", label: "Banco", type: "text", required: true },
                      {
                        key: "size_mb",
                        label: "Tamanho",
                        type: "number",
                        render: (row) => formatBytes(Number(row["size_mb"] ?? 0)),
                      },
                      { key: "is_on_backup", label: "Em backup", type: "boolean" },
                      { key: "is_active", label: "Ativo", type: "boolean", formOnly: true },
                      { key: "comment", label: "Comentário", type: "text", formOnly: true },
                    ]}
                  />
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    {roomsQuery.data?.length ?? 0} sala(s) de servidores cadastrada(s) no total.
                  </p>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
