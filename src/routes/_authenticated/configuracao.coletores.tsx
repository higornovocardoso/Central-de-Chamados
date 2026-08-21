import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

export const Route = createFileRoute("/_authenticated/configuracao/coletores")({
  head: () => ({
    meta: [
      { title: "Coletores de e-mail — Helpdesk T.I." },
      {
        name: "description",
        content: "Caixas de e-mail que viram chamados, e a lista negra de remetentes.",
      },
    ],
  }),
  component: Coletores,
});

const TYPES = [
  { value: "incidente", label: "Incidente" },
  { value: "requisicao", label: "Requisição" },
];

function Coletores() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const canWrite = can("collector", "update");

  const baseUrl = import.meta.env["VITE_SUPABASE_URL"] ?? "";

  const categoriesQuery = useQuery({
    queryKey: ["itil_categories_options"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("itil_categories").select("*").order("path");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ["request_sources_options"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("request_sources").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({
    value: c.id,
    label: String(c["name"]),
  }));
  const sourceOptions = (sourcesQuery.data ?? []).map((s) => ({
    value: s.id,
    label: String(s["name"]),
  }));

  function webhookUrl(row: LooseRow) {
    return `${baseUrl}/functions/v1/inbound-email?token=${String(row["secret_token"] ?? "")}`;
  }

  async function copy(row: LooseRow) {
    try {
      await navigator.clipboard.writeText(webhookUrl(row));
      toast.success("Endereço copiado.");
    } catch {
      toast.error("Não foi possível copiar", { description: webhookUrl(row) });
    }
  }

  return (
    <AppShell
      title="Coletores de e-mail"
      subtitle="Uma mensagem recebida vira chamado; a resposta a um chamado vira acompanhamento."
      breadcrumbTail="Coletores"
    >
      <Tabs defaultValue="coletores">
        <TabsList className="min-h-8">
          <TabsTrigger value="coletores" className="text-xs">
            Coletores
          </TabsTrigger>
          <TabsTrigger value="lista-negra" className="text-xs">
            Lista negra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coletores" className="mt-3">
          <CrudTable
            table="mail_collectors"
            queryKey="mail_collectors"
            canWrite={canWrite}
            emptyText="Nenhum coletor configurado."
            defaults={{
              name: "",
              inbound_address: "",
              entity_id: entities[0]?.value ?? "",
              default_type: "incidente",
              default_category_id: categoryOptions[0]?.value ?? "",
              default_source_id: sourceOptions[0]?.value ?? "",
              is_active: true,
              comment: "",
            }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "inbound_address", label: "Endereço de entrada", type: "text" },
              { key: "default_type", label: "Tipo padrão", type: "select", options: TYPES },
              {
                key: "default_category_id",
                label: "Categoria padrão",
                type: "select",
                options: categoryOptions,
              },
              {
                key: "default_source_id",
                label: "Origem padrão",
                type: "select",
                options: sourceOptions,
                formOnly: true,
              },
              { key: "is_active", label: "Ativo", type: "boolean" },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
            ]}
            extraActions={(row) => (
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Copiar endereço do webhook"
                onClick={(e) => {
                  e.stopPropagation();
                  copy(row);
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            )}
          />

          <div className="panel mt-3 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Como ligar a caixa de e-mail</p>
            <p className="mb-2">
              O GLPI busca as mensagens por IMAP. Aqui o caminho é o inverso e mais simples: o
              provedor entrega a mensagem para o sistema por webhook. Configure o e-mail de suporte
              (no Resend Inbound, Postmark ou um Email Worker da Cloudflare) para enviar a mensagem
              recebida para o endereço do coletor — use o botão de copiar na lista.
            </p>
            <p className="font-mono text-[0.72rem]">
              POST {baseUrl}/functions/v1/inbound-email?token=SEU_TOKEN
            </p>
            <p className="mt-2">
              Assunto com o número de um chamado (por exemplo <code>#A1B2C3D4</code>) vira
              acompanhamento daquele chamado; o resto abre chamado novo. Remetente conhecido entra
              como requerente; desconhecido preenche nome e e-mail livres, como o formulário
              público.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="lista-negra" className="mt-3">
          <CrudTable
            table="collector_blacklist"
            queryKey="collector_blacklist"
            orderBy="value"
            canWrite={canWrite}
            emptyText="Nenhum remetente bloqueado."
            defaults={{ kind: "email", value: "", comment: "" }}
            fields={[
              { key: "value", label: "E-mail ou domínio", type: "text", required: true },
              { key: "comment", label: "Motivo", type: "text" },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Serve para o que não deve virar chamado: alertas automáticos de backup, boletins,
            respostas de "não responda". Aceita o endereço inteiro ou só o domínio.
          </p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
