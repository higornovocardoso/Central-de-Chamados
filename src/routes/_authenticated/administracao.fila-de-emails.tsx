import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DataToolbar } from "@/components/DataToolbar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/Tag";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { applySearch, type MatchMode, type SearchCriterion } from "@/lib/search";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/administracao/fila-de-emails")({
  head: () => ({
    meta: [
      { title: "Fila de e-mails — Helpdesk T.I." },
      {
        name: "description",
        content: "As notificações aguardando envio, as que saíram e as que falharam.",
      },
    ],
  }),
  component: FilaDeEmails,
});

const STATE_CLASS: Record<string, string> = {
  pendente: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
  enviado: "border-success/30 bg-success/15 text-success",
  erro: "border-destructive/40 bg-destructive/15 text-destructive",
};

const STATE_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  erro: "Erro",
};

function FilaDeEmails() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<SearchCriterion[]>([]);
  const [mode, setMode] = useState<MatchMode>("and");
  const [freeText, setFreeText] = useState("");

  const canManage = can("mailqueue", "update");

  const fila = useQuery({
    queryKey: ["notification_queue"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("notification_queue")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).slice(0, 500);
    },
  });

  /** Reenviar é devolver a mensagem para "pendente" e chamar a edge function. */
  const reenviar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb
        .from("notification_queue")
        .update({ state: "pendente", attempts: 0, error: "" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Mensagem devolvida para a fila.");
      queryClient.invalidateQueries({ queryKey: ["notification_queue"] });
    },
    onError: (e: Error) => toast.error("Não foi possível reenfileirar", { description: e.message }),
  });

  const enviarAgora = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-notifications", { body: {} });
      if (error) throw new Error(error.message);
      const r = data as { sent?: number; pending?: number; warning?: string };
      return r.warning ?? `${r.sent ?? 0} mensagem(ns) enviada(s)`;
    },
    onSuccess: (msg) => {
      toast.success("Fila processada", { description: msg });
      queryClient.invalidateQueries({ queryKey: ["notification_queue"] });
    },
    onError: (e: Error) => toast.error("Falha ao processar a fila", { description: e.message }),
  });

  const linhas = useMemo(
    () => (fila.data ?? []) as unknown as Record<string, unknown>[],
    [fila.data],
  );

  const fields = useMemo(
    () => [
      { key: "recipient_email", label: "Destinatário" },
      { key: "subject", label: "Assunto" },
      {
        key: "state",
        label: "Situação",
        accessor: (r: Record<string, unknown>) => STATE_LABEL[String(r["state"])] ?? r["state"],
      },
      { key: "error", label: "Erro" },
    ],
    [],
  );

  const filtradas = applySearch(linhas, criteria, fields, mode, freeText);

  const contar = useCallback(
    (estado: string) => linhas.filter((l) => l["state"] === estado).length,
    [linhas],
  );

  if (!can("mailqueue", "read")) {
    return (
      <AppShell title="Fila de e-mails">
        <div className="panel p-8 text-center text-xs text-muted-foreground">
          Seu perfil não tem acesso à fila de e-mails.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Fila de e-mails"
      subtitle="O que o sistema tem para enviar, o que já saiu e o que falhou."
      breadcrumbTail="Fila de e-mails"
      actions={
        canManage ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => enviarAgora.mutate()}
            disabled={enviarAgora.isPending}
          >
            <Send className="size-3.5" /> Enviar agora
          </Button>
        ) : null
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="tile tile-warning">
          <span className="tile-number">{contar("pendente")}</span>
          <span className="tile-label">Pendentes</span>
        </div>
        <div className="tile tile-success">
          <span className="tile-number">{contar("enviado")}</span>
          <span className="tile-label">Enviados</span>
        </div>
        <div className="tile tile-danger">
          <span className="tile-number">{contar("erro")}</span>
          <span className="tile-label">Com erro</span>
        </div>
      </div>

      <DataToolbar
        itemType="notification_queue"
        title="Fila de e-mails"
        fields={fields}
        criteria={criteria}
        onCriteriaChange={setCriteria}
        mode={mode}
        onModeChange={setMode}
        freeText={freeText}
        onFreeTextChange={setFreeText}
        rows={filtradas}
        columns={[
          { key: "created_at", label: "Criada em" },
          { key: "recipient_email", label: "Destinatário" },
          { key: "subject", label: "Assunto" },
          { key: "state", label: "Situação" },
        ]}
        accessor={(row, key) => {
          if (key === "created_at") return formatDate(String(row["created_at"]));
          if (key === "state") return STATE_LABEL[String(row["state"])] ?? row["state"];
          return row[key];
        }}
        total={linhas.length}
        shown={filtradas.length}
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Criada em</th>
                <th>Destinatário</th>
                <th>Assunto</th>
                <th>Situação</th>
                <th>Tentativas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhuma mensagem na fila.
                  </td>
                </tr>
              )}
              {(filtradas as LooseRow[]).map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {formatDate(String(m["created_at"]))}
                  </td>
                  <td>{String(m["recipient_email"])}</td>
                  <td className="max-w-[320px] truncate">{String(m["subject"])}</td>
                  <td>
                    <Tag className={STATE_CLASS[String(m["state"])] ?? ""}>
                      {STATE_LABEL[String(m["state"])] ?? String(m["state"])}
                    </Tag>
                    {m["error"] ? (
                      <p className="mt-1 max-w-[280px] truncate text-[0.68rem] text-destructive">
                        {String(m["error"])}
                      </p>
                    ) : null}
                  </td>
                  <td className="tabular-nums">{String(m["attempts"] ?? 0)}</td>
                  <td>
                    {canManage && m["state"] !== "pendente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => reenviar.mutate(m.id)}
                      >
                        <RefreshCw className="size-3" /> Reenviar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Quem entrega as mensagens é a edge function <code>send-notifications</code>. Sem os segredos{" "}
        <code>RESEND_API_KEY</code> e <code>NOTIFY_FROM</code> configurados, ela responde que o envio
        está desligado e a fila fica intacta — nada se perde.
      </p>
    </AppShell>
  );
}
