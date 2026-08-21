import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { ASSET_KIND_LABEL, ASSET_STATUS_LABEL, type AssetKind, type AssetStatus } from "@/lib/glpi";
import { formatMoneyBR } from "@/lib/inventory";
import { STATUS_LABEL, isOpenStatus, type TicketStatus } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/ferramentas/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios" },
      {
        name: "description",
        content: "Chamados por período, parque por tipo, garantias e contratos vencendo.",
      },
    ],
  }),
  component: Relatorios,
});

type Line = { label: string; value: string };

const REPORTS = [
  { key: "chamados_status", label: "Chamados por status" },
  { key: "chamados_categoria", label: "Chamados por categoria" },
  { key: "chamados_tecnico", label: "Chamados por técnico" },
  { key: "ativos_tipo", label: "Parque por tipo" },
  { key: "ativos_situacao", label: "Parque por situação" },
  { key: "garantias", label: "Garantias vencendo em 90 dias" },
  { key: "contratos", label: "Contratos por ano de término" },
  { key: "financeiro", label: "Valor do parque por tipo" },
];

function Relatorios() {
  const { can } = usePermissions();
  const acesso = useAcesso("report");
  const [report, setReport] = useState("chamados_status");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at");
      return (data ?? []) as (Record<string, unknown> & { id: string })[];
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("*").order("name");
      return (data ?? []) as (Record<string, unknown> & { id: string })[];
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email");
      return data ?? [];
    },
  });

  const infocomsQuery = useQuery({
    queryKey: ["asset_infocoms_all"],
    queryFn: async () => {
      const { data } = await looseDb.from("asset_infocoms").select("*").order("id");
      return data ?? [];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await looseDb.from("contracts").select("*").order("name");
      return data ?? [];
    },
  });

  const personName = useCallback(
    (id: unknown) => {
      const found = (peopleQuery.data ?? []).find((p) => p.id === String(id));
      return found ? found.full_name || found.email : "Não atribuído";
    },
    [peopleQuery.data],
  );

  const lines: Line[] = useMemo(() => {
    const tickets = (ticketsQuery.data ?? []).filter((t) => {
      const created = String(t["created_at"] ?? "").slice(0, 10);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
    const assets = assetsQuery.data ?? [];
    const count = (map: Map<string, number>) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value: String(value) }));

    const tally = (rows: unknown[], keyOf: (row: never) => string) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const key = keyOf(row as never);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };

    switch (report) {
      case "chamados_status":
        return count(
          tally(tickets, (t) => STATUS_LABEL[String(t["status"]) as TicketStatus] ?? "—"),
        );
      case "chamados_categoria":
        return count(tally(tickets, (t) => String(t["category"] ?? "Sem categoria")));
      case "chamados_tecnico":
        return count(tally(tickets, (t) => personName(t["assignee_id"])));
      case "ativos_tipo":
        return count(tally(assets, (a) => ASSET_KIND_LABEL[String(a["kind"]) as AssetKind] ?? "—"));
      case "ativos_situacao":
        return count(
          tally(assets, (a) => ASSET_STATUS_LABEL[String(a["status"]) as AssetStatus] ?? "—"),
        );
      case "garantias": {
        const limit = new Date();
        limit.setDate(limit.getDate() + 90);
        return assets
          .filter((a) => {
            const end = a["warranty_end"];
            if (!end) return false;
            const date = new Date(String(end) + "T12:00:00");
            return date <= limit;
          })
          .map((a) => ({
            label: String(a["name"]),
            value: new Date(String(a["warranty_end"]) + "T12:00:00").toLocaleDateString("pt-BR"),
          }));
      }
      case "contratos": {
        const map = new Map<string, number>();
        for (const c of contractsQuery.data ?? []) {
          const start = c["start_date"];
          if (!start) continue;
          const end = new Date(String(start) + "T12:00:00");
          end.setMonth(end.getMonth() + Number(c["initial_months"] ?? 0));
          const year = String(end.getFullYear());
          map.set(year, (map.get(year) ?? 0) + 1);
        }
        return [...map.entries()]
          .sort()
          .map(([label, value]) => ({ label, value: String(value) }));
      }
      case "financeiro": {
        const byKind = new Map<string, number>();
        for (const i of infocomsQuery.data ?? []) {
          const asset = assets.find((a) => a.id === i["asset_id"]);
          const kind = ASSET_KIND_LABEL[String(asset?.["kind"]) as AssetKind] ?? "Outro";
          byKind.set(kind, (byKind.get(kind) ?? 0) + Number(i["value"] ?? 0));
        }
        return [...byKind.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value: formatMoneyBR(value) }));
      }
      default:
        return [];
    }
  }, [
    report,
    from,
    to,
    ticketsQuery.data,
    assetsQuery.data,
    personName,
    infocomsQuery.data,
    contractsQuery.data,
  ]);

  const summary = useMemo(() => {
    const tickets = ticketsQuery.data ?? [];
    return {
      total: tickets.length,
      open: tickets.filter((t) => isOpenStatus(String(t["status"]) as TicketStatus)).length,
      assets: (assetsQuery.data ?? []).length,
    };
  }, [ticketsQuery.data, assetsQuery.data]);

  function exportCsv() {
    const name = REPORTS.find((r) => r.key === report)?.label ?? "relatorio";
    const rows = [["Item", "Valor"], ...lines.map((l) => [l.label, l.value])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="Relatórios" estado={acesso} mensagem="Seu perfil não tem acesso aos relatórios." />;
  }

  return (
    <AppShell
      title="Relatórios"
      subtitle="Os números que a diretoria pede, prontos para exportar."
      breadcrumbTail="Relatórios"
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="panel px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Chamados no total</span>
          <p className="mt-1 text-xl font-semibold tabular-nums">{summary.total}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Em aberto</span>
          <p className="mt-1 text-xl font-semibold tabular-nums">{summary.open}</p>
        </div>
        <div className="panel px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Ativos cadastrados</span>
          <p className="mt-1 text-xl font-semibold tabular-nums">{summary.assets}</p>
        </div>
      </div>

      <section className="panel mb-3 p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
          <div className="space-y-1">
            <Label className="text-[0.7rem] text-muted-foreground">Relatório</Label>
            <select
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
            >
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[0.7rem] text-muted-foreground">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[0.7rem] text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-end">
            <Button size="sm" className="h-8" onClick={exportCsv} disabled={lines.length === 0}>
              <Download className="size-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[0.68rem] text-muted-foreground">
          O período filtra apenas os relatórios de chamado, pela data de abertura.
        </p>
      </section>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-40 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-muted-foreground">
                    Sem dados para este relatório.
                  </td>
                </tr>
              )}
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>{line.label}</td>
                  <td className="text-right font-medium tabular-nums">{line.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
