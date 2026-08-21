import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/configuracao/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Helpdesk T.I." },
      {
        name: "description",
        content: "Eventos que geram e-mail, modelos de mensagem e a fila de envio.",
      },
    ],
  }),
  component: Notificacoes,
});

/** Os eventos que o banco dispara hoje. */
const EVENTS = [
  { value: "ticket_criado", label: "Chamado aberto" },
  { value: "acompanhamento_adicionado", label: "Acompanhamento adicionado" },
  { value: "ticket_solucionado", label: "Chamado solucionado" },
  { value: "ticket_fechado", label: "Chamado fechado" },
  { value: "aprovacao_solicitada", label: "Aprovação solicitada" },
  { value: "escalonamento", label: "Escalonamento de SLA" },
];

const RECIPIENT_TYPES = [
  { value: "requerente", label: "Requerente" },
  { value: "atribuido", label: "Técnico atribuído" },
  { value: "observador", label: "Observador" },
  { value: "aprovador", label: "Aprovador" },
  { value: "administrador", label: "Administrador da entidade" },
];

const QUEUE_CLASS: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  enviado: "bg-success/15 text-success border-success/30",
  erro: "bg-destructive/15 text-destructive border-destructive/40",
};

function Notificacoes() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const entities = useEntityOptions();
  const canWrite = can("notification", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [recipientType, setRecipientType] = useState("requerente");

  const templatesQuery = useQuery({
    queryKey: ["notification_templates"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("notification_templates").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const templateOptions = (templatesQuery.data ?? []).map((t) => ({
    value: t.id,
    label: String(t["name"]),
  }));

  const recipientsQuery = useQuery({
    queryKey: ["notification_recipients", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("notification_recipients")
        .select("*")
        .eq("notification_id", String(selected?.id))
        .order("recipient_type");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const queueQuery = useQuery({
    queryKey: ["notification_queue"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("notification_queue")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).slice(0, 100);
    },
  });

  const addRecipient = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("notification_recipients").insert({
        notification_id: selected?.id,
        recipient_type: recipientType,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notification_recipients", selected?.id] }),
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeRecipient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("notification_recipients").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notification_recipients", selected?.id] }),
  });

  /** Chama a edge function que entrega a fila pelo Resend. */
  const sendQueue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-notifications", { body: {} });
      if (error) throw new Error(error.message);
      return data as { sent?: number; pending?: number; warning?: string };
    },
    onSuccess: (data) => {
      if (data?.warning) {
        toast.warning("Envio desligado", { description: data.warning });
      } else {
        toast.success(`${data?.sent ?? 0} mensagem(ns) enviada(s).`);
      }
      queryClient.invalidateQueries({ queryKey: ["notification_queue"] });
    },
    onError: (e: Error) =>
      toast.error("Falha ao enviar", {
        description: `${e.message}. Verifique se a função send-notifications está publicada.`,
      }),
  });

  const pending = (queueQuery.data ?? []).filter((q) => q["state"] === "pendente").length;

  return (
    <AppShell
      title="Notificações"
      subtitle="Quais eventos geram e-mail, para quem, com qual texto — e a fila de envio."
      breadcrumbTail="Notificações"
    >
      <Tabs defaultValue="notificacoes">
        <TabsList className="min-h-8">
          <TabsTrigger value="notificacoes" className="text-xs">
            Notificações
          </TabsTrigger>
          <TabsTrigger value="modelos" className="text-xs">
            Modelos
          </TabsTrigger>
          <TabsTrigger value="fila" className="text-xs">
            Fila ({pending} pendente{pending === 1 ? "" : "s"})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notificacoes" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <CrudTable
              table="notifications"
              queryKey="notifications"
              canWrite={canWrite}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              emptyText="Nenhuma notificação configurada."
              defaults={{
                name: "",
                event: "ticket_criado",
                template_id: templateOptions[0]?.value ?? "",
                entity_id: entities[0]?.value ?? "",
                is_active: true,
              }}
              fields={[
                { key: "name", label: "Nome", type: "text", required: true },
                { key: "event", label: "Evento", type: "select", options: EVENTS },
                {
                  key: "template_id",
                  label: "Modelo",
                  type: "select",
                  options: templateOptions,
                },
                { key: "is_active", label: "Ativa", type: "boolean" },
                {
                  key: "entity_id",
                  label: "Entidade",
                  type: "select",
                  options: entities,
                  formOnly: true,
                },
              ]}
            />

            <section className="panel h-fit overflow-hidden">
              <header className="panel-header">
                {selected ? `Destinatários de ${selected["name"]}` : "Destinatários"}
              </header>
              {!selected ? (
                <p className="p-4 text-xs text-muted-foreground">Escolha uma notificação.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {(recipientsQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-4 text-xs text-muted-foreground">
                        Sem destinatário: nada será enviado.
                      </li>
                    )}
                    {(recipientsQuery.data ?? []).map((r) => (
                      <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="flex-1">
                          {RECIPIENT_TYPES.find((t) => t.value === r["recipient_type"])?.label ??
                            String(r["recipient_type"])}
                        </span>
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Remover destinatário"
                            onClick={() => removeRecipient.mutate(r.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="flex gap-2 border-t border-border p-2">
                      <select
                        value={recipientType}
                        onChange={(e) => setRecipientType(e.target.value)}
                        className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        {RECIPIENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" className="h-8" onClick={() => addRecipient.mutate()}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="modelos" className="mt-3">
          <CrudTable
            table="notification_templates"
            queryKey="notification_templates"
            canWrite={canWrite}
            emptyText="Nenhum modelo cadastrado."
            defaults={{ name: "", subject: "", body_text: "", comment: "" }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              { key: "subject", label: "Assunto", type: "text" },
              { key: "body_text", label: "Corpo da mensagem", type: "textarea" },
              { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
            ]}
          />
          <div className="panel mt-3 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Etiquetas disponíveis</p>
            <p className="font-mono text-[0.72rem]">
              ##numero## ##titulo## ##descricao## ##tipo## ##prioridade## ##requerente## ##prazo##
              ##conteudo## ##destinatario## ##prefixo## ##assinatura##
            </p>
          </div>
        </TabsContent>

        <TabsContent value="fila" className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              As mensagens ficam aqui até a função <code>send-notifications</code> entregá-las.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => queueQuery.refetch()}
              >
                <RefreshCw className="size-3.5" /> Atualizar
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={() => sendQueue.mutate()}
                disabled={sendQueue.isPending}
              >
                <Send className="size-3.5" /> Enviar agora
              </Button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="glpi-table">
                <thead>
                  <tr>
                    <th>Situação</th>
                    <th>Destinatário</th>
                    <th>Assunto</th>
                    <th>Tentativas</th>
                    <th>Criada em</th>
                    <th>Enviada em</th>
                  </tr>
                </thead>
                <tbody>
                  {queueQuery.isError && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        A fila ainda não existe no banco. Aplique a migration da fase 4.
                      </td>
                    </tr>
                  )}
                  {(queueQuery.data ?? []).length === 0 && !queueQuery.isError && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Nenhuma mensagem na fila.
                      </td>
                    </tr>
                  )}
                  {(queueQuery.data ?? []).map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Tag className={QUEUE_CLASS[String(q["state"])] ?? ""}>
                          {String(q["state"])}
                        </Tag>
                      </td>
                      <td>{String(q["recipient_email"])}</td>
                      <td className="max-w-[320px] truncate">{String(q["subject"])}</td>
                      <td className="tabular-nums">{String(q["attempts"] ?? 0)}</td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {formatDate(String(q["created_at"]))}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {q["sent_at"] ? formatDate(String(q["sent_at"])) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel mt-3 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Para o envio funcionar</p>
            <p>
              Publique a função <code>send-notifications</code> e configure dois segredos no
              Supabase: <code>RESEND_API_KEY</code> com a chave do Resend e{" "}
              <code>NOTIFY_FROM</code> com o remetente. Sem a chave, a fila apenas acumula — nada é
              perdido.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
