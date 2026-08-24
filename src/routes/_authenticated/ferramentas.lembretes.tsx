import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

export const Route = createFileRoute("/_authenticated/ferramentas/lembretes")({
  // O menu do GLPI lista estes objetos separadamente; aqui eles
  // dividem a mesma tela, então a aba vem pela URL.
  validateSearch: (search: Record<string, unknown>): { aba: "lembretes" | "rss" } => {
    const aba = String(search["aba"] ?? "");
    return {
      aba: (["lembretes", "rss"] as const).includes(aba as never)
        ? (aba as "lembretes" | "rss")
        : "lembretes",
    };
  },
  head: () => ({
    meta: [
      { title: "Lembretes e feeds" },
      {
        name: "description",
        content: "Anotações da equipe e feeds RSS acompanhados pelo time de T.I.",
      },
    ],
  }),
  component: Lembretes,
});

function Lembretes() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const entities = useEntityOptions();

  return (
    <AppShell
      title="Lembretes e feeds"
      subtitle="O que a equipe precisa lembrar, e o que vale acompanhar de fora."
      breadcrumbTail="Lembretes"
    >
      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
        <TabsList className="min-h-8">
          <TabsTrigger value="lembretes" className="text-xs">
            Lembretes
          </TabsTrigger>
          <TabsTrigger value="rss" className="text-xs">
            Feeds RSS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lembretes" className="mt-3">
          <CrudTable
            table="reminders"
            queryKey="reminders"
            canWrite={can("reminder", "update")}
            emptyText="Nenhum lembrete."
            defaults={{
              name: "",
              body: "",
              is_public: false,
              begin_at: "",
              end_at: "",
              entity_id: entities[0]?.value ?? "",
            }}
            fields={[
              { key: "name", label: "Lembrete", type: "text", required: true },
              { key: "is_public", label: "Público", type: "boolean" },
              { key: "begin_at", label: "De", type: "datetime" },
              { key: "end_at", label: "Até", type: "datetime" },
              { key: "body", label: "Texto", type: "textarea" },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Lembrete público aparece para toda a equipe; privado, só para quem criou.
          </p>
        </TabsContent>

        <TabsContent value="rss" className="mt-3">
          <CrudTable
            table="rss_feeds"
            queryKey="rss_feeds"
            canWrite={can("rssfeed", "update")}
            emptyText="Nenhum feed cadastrado."
            defaults={{
              name: "",
              url: "",
              refresh_minutes: 60,
              max_items: 10,
              is_active: true,
              is_public: false,
              entity_id: entities[0]?.value ?? "",
              comment: "",
            }}
            fields={[
              { key: "name", label: "Feed", type: "text", required: true },
              { key: "url", label: "Endereço", type: "text", required: true },
              { key: "is_active", label: "Ativo", type: "boolean" },
              { key: "is_public", label: "Público", type: "boolean" },
              {
                key: "refresh_minutes",
                label: "Atualiza a cada (min)",
                type: "number",
                formOnly: true,
              },
              { key: "max_items", label: "Máximo de itens", type: "number", formOnly: true },
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
            O cadastro guarda os feeds. A leitura do conteúdo precisa passar por uma função no
            servidor, porque o navegador bloqueia a busca direta em outro domínio.
          </p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
