import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/configuracao/acoes-automaticas")({
  head: () => ({
    meta: [
      { title: "Ações automáticas" },
      {
        name: "description",
        content: "As rotinas que rodam sozinhas: fechamento, recorrentes, satisfação e SLA.",
      },
    ],
  }),
  component: AcoesAutomaticas,
});

function AcoesAutomaticas() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canWrite = can("config", "update");

  const actionsQuery = useQuery({
    queryKey: ["automatic_actions"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("automatic_actions").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; value: boolean }) => {
      const { error } = await looseDb
        .from("automatic_actions")
        .update({ is_active: input.value })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automatic_actions"] }),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  /** Executa a rotina na hora, sem esperar o agendador. */
  const runNow = useMutation({
    mutationFn: async (code: string) => {
      if (code === "enviar_fila") {
        const { data, error } = await supabase.functions.invoke("send-notifications", { body: {} });
        if (error) throw new Error(error.message);
        const result = data as { sent?: number; warning?: string };
        return result.warning ?? `${result.sent ?? 0} mensagem(ns) enviada(s)`;
      }

      // O molde vai no cliente, não no método: arrancar supabase.rpc do
      // objeto perde o `this` e a chamada estoura.
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("run_automatic_action", { _code: code });
      if (error) throw new Error(error.message);
      return String(data ?? "Executada");
    },
    onSuccess: (result) => {
      toast.success("Ação executada", { description: result });
      queryClient.invalidateQueries({ queryKey: ["automatic_actions"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notification_queue"] });
    },
    onError: (e: Error) => toast.error("Falha ao executar", { description: e.message }),
  });

  return (
    <AppShell
      title="Ações automáticas"
      subtitle="As rotinas do GLPI que rodam sozinhas, e o botão para forçar cada uma."
      breadcrumbTail="Ações automáticas"
    >
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th className="w-16">Ativa</th>
                <th>Ação</th>
                <th>O que faz</th>
                <th>Frequência</th>
                <th>Última execução</th>
                <th>Resultado</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {actionsQuery.isError && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    A tabela ainda não existe no banco. Aplique a migration da fase 4.
                  </td>
                </tr>
              )}
              {(actionsQuery.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>
                    <Checkbox
                      checked={a["is_active"] === true}
                      disabled={!canWrite}
                      onCheckedChange={(v) => toggle.mutate({ id: a.id, value: v === true })}
                      aria-label={`Ativar ${String(a["name"])}`}
                    />
                  </td>
                  <td className="font-medium">{String(a["name"])}</td>
                  <td className="max-w-[360px] text-muted-foreground">
                    {String(a["description"])}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    a cada {String(a["frequency_minutes"])} min
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {a["last_run_at"] ? formatDate(String(a["last_run_at"])) : "nunca"}
                  </td>
                  <td className="text-muted-foreground">{String(a["last_result"] || "—")}</td>
                  <td>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={runNow.isPending}
                        onClick={() => runNow.mutate(String(a["code"]))}
                      >
                        <Play className="size-3" /> Executar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel mt-3 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Sobre o agendamento</p>
        <p>
          A migration tenta agendar as rotinas do banco pelo <code>pg_cron</code>, a cada 15
          minutos. Se a extensão não estiver disponível, nada quebra — as rotinas continuam
          funcionando pelo botão Executar acima. O envio da fila de e-mails roda sempre pela edge
          function, nunca pelo banco.
        </p>
      </div>
    </AppShell>
  );
}
