import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { DataToolbar } from "@/components/DataToolbar";
import { Tag } from "@/components/Tag";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { applySearch, type MatchMode, type SearchCriterion } from "@/lib/search";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/administracao/logs")({
  head: () => ({
    meta: [
      { title: "Logs — Helpdesk T.I." },
      {
        name: "description",
        content: "Trilha de auditoria: quem mexeu em perfil, entidade e autorização.",
      },
    ],
  }),
  component: Logs,
});

const SEVERITY_CLASS: Record<string, string> = {
  info: "border-border bg-secondary text-muted-foreground",
  aviso: "border-warning/40 bg-warning/20 text-warning-foreground dark:text-warning",
  erro: "border-destructive/40 bg-destructive/15 text-destructive",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
  login: "Entrada no sistema",
  export: "Exportação",
};

function Logs() {
  const { can } = usePermissions();
  const acesso = useAcesso("log");
  const [criteria, setCriteria] = useState<SearchCriterion[]>([]);
  const [mode, setMode] = useState<MatchMode>("and");
  const [freeText, setFreeText] = useState("");

  const logsQuery = useQuery({
    queryKey: ["system_logs"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).slice(0, 500);
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email");
      return data ?? [];
    },
  });

  const personName = useCallback(
    (id: unknown) => {
      const found = (peopleQuery.data ?? []).find((p) => p.id === String(id));
      return found ? found.full_name || found.email : "Sistema";
    },
    [peopleQuery.data],
  );

  const fields = useMemo(
    () => [
      { key: "action", label: "Ação", accessor: (r: Record<string, unknown>) => ACTION_LABEL[String(r["action"])] ?? r["action"] },
      { key: "item_type", label: "Objeto" },
      { key: "detail", label: "Detalhe" },
      { key: "severity", label: "Gravidade" },
      {
        key: "user_id",
        label: "Usuário",
        accessor: (r: Record<string, unknown>) => personName(r["user_id"]),
      },
    ],
    [personName],
  );

  const logs = (logsQuery.data ?? []) as unknown as Record<string, unknown>[];
  const filtered = applySearch(logs, criteria, fields, mode, freeText);

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="Logs" estado={acesso} mensagem="Seu perfil não tem acesso aos logs do sistema." />;
  }

  return (
    <AppShell
      title="Logs"
      subtitle="Quem mexeu em perfil, entidade e autorização — e quando."
      breadcrumbTail="Logs"
    >
      <DataToolbar
        itemType="system_log"
        title="Logs do sistema"
        fields={fields}
        criteria={criteria}
        onCriteriaChange={setCriteria}
        mode={mode}
        onModeChange={setMode}
        freeText={freeText}
        onFreeTextChange={setFreeText}
        rows={filtered}
        columns={[
          { key: "created_at", label: "Data" },
          { key: "user_id", label: "Usuário" },
          { key: "action", label: "Ação" },
          { key: "item_type", label: "Objeto" },
          { key: "detail", label: "Detalhe" },
        ]}
        accessor={(row, key) => {
          if (key === "user_id") return personName(row["user_id"]);
          if (key === "action") return ACTION_LABEL[String(row["action"])] ?? row["action"];
          if (key === "created_at") return formatDate(String(row["created_at"]));
          return row[key];
        }}
        total={logs.length}
        shown={filtered.length}
      />

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Objeto</th>
                <th>Detalhe</th>
                <th>Gravidade</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    A tabela de logs ainda não existe no banco. Aplique a migration da fase 8.
                  </td>
                </tr>
              )}
              {filtered.length === 0 && !logsQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum registro no log.
                  </td>
                </tr>
              )}
              {(filtered as LooseRow[]).map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {formatDate(String(log["created_at"]))}
                  </td>
                  <td>{personName(log["user_id"])}</td>
                  <td className="font-medium">
                    {ACTION_LABEL[String(log["action"])] ?? String(log["action"])}
                  </td>
                  <td className="font-mono text-[0.72rem]">{String(log["item_type"] || "—")}</td>
                  <td className="max-w-[320px] truncate text-muted-foreground">
                    {String(log["detail"] || "—")}
                  </td>
                  <td>
                    <Tag className={SEVERITY_CLASS[String(log["severity"])] ?? ""}>
                      {String(log["severity"])}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Mostra os 500 registros mais recentes. Alterações em perfis, autorizações e entidades são
        gravadas automaticamente por gatilho; o histórico campo a campo de cada chamado e ativo
        fica na aba Histórico do próprio registro.
      </p>
    </AppShell>
  );
}
