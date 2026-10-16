import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

type Aba = "categorias" | "locais";

export const Route = createFileRoute("/_authenticated/categorias")({
  validateSearch: (search: Record<string, unknown>): { aba?: Aba | undefined } =>
    search["aba"] === "locais" ? { aba: "locais" } : {},
  head: () => ({
    meta: [
      { title: "Categorias" },
      {
        name: "description",
        content: "Categorias de chamado e locais que aparecem no formulário de abertura.",
      },
    ],
  }),
  component: Categorias,
});

/**
 * Antes as categorias de chamado só existiam no banco, sem tela, e os locais
 * moravam em Cadastros junto com o inventário. Os dois são as listas que o
 * formulário do chamado usa, então ficam juntos aqui.
 */
function Categorias() {
  const { aba = "categorias" } = Route.useSearch();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("dropdown", "update");

  return (
    <AppShell
      title="Categorias"
      subtitle="As listas que aparecem no formulário do chamado."
      breadcrumbTail={aba === "locais" ? "Locais" : "Categorias"}
    >
      <Tabs
        value={aba}
        onValueChange={(v) =>
          navigate({
            to: "/categorias",
            search: v === "locais" ? { aba: "locais" } : {},
          })
        }
      >
        <TabsList>
          <TabsTrigger value="categorias">Categorias de chamado</TabsTrigger>
          <TabsTrigger value="locais">Locais</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <CrudTable
            table="itil_categories"
            queryKey="itil_categories_options"
            orderBy="path"
            canWrite={canWrite}
            emptyText="Nenhuma categoria cadastrada. Crie a primeira para usar no formulário do chamado."
            defaults={{
              name: "",
              comment: "",
              visible_incident: true,
              visible_request: true,
              entity_id: entities[0]?.value ?? "",
            }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "visible_incident", label: "Em incidentes", type: "boolean" },
              { key: "visible_request", label: "Em requisições", type: "boolean" },
              {
                key: "entity_id",
                label: "Empresa",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "comment", label: "Observação", type: "textarea", formOnly: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="locais" className="mt-4">
          <CrudTable
            table="locations"
            queryKey="locations"
            canWrite={canWrite}
            emptyText="Nenhum local cadastrado."
            defaults={{
              name: "",
              building: "",
              notes: "",
              entity_id: entities[0]?.value ?? "",
            }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "building", label: "Prédio / andar", type: "text" },
              {
                key: "entity_id",
                label: "Empresa",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "notes", label: "Observações", type: "textarea" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
