import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { slaState } from "@/lib/glpi";
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  isOpenStatus,
  relativeTime,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Visão geral dos chamados de T.I.: contadores por status, SLA, carga por técnico e evolução no mês.",
      },
      { property: "og:title", content: "Painel — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Contadores por status, SLA e carga da equipe de suporte.",
      },
    ],
  }),
  component: Painel,
});

type TicketRow = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_due_at: string | null;
  requester_id: string | null;
  reporter_name: string;
  assignee_id: string | null;
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Painel() {
  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,title,category,status,priority,created_at,updated_at,resolved_at,resolution_due_at,requester_id,assignee_id,reporter_name",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TicketRow[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email");
      if (error) throw error;
      return data;
    },
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilesQuery.data ?? []) map.set(p.id, p.full_name || p.email);
    return map;
  }, [profilesQuery.data]);

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);

  const counters = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        label: STATUS_LABEL[status],
        value: tickets.filter((t) => t.status === status).length,
      })),
    [tickets],
  );

  const late = useMemo(
    () =>
      tickets.filter(
        (t) => slaState(t.resolution_due_at, t.resolved_at, t.status === "fechado").late,
      ),
    [tickets],
  );

  const avgHours = useMemo(() => {
    const durations = tickets
      .filter((t) => t.resolved_at)
      .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000;
  }, [tickets]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tickets]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) {
      if (!isOpenStatus(t.status)) continue;
      const key = t.assignee_id ? (nameById.get(t.assignee_id) ?? "—") : "Não atribuído";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [tickets, nameById]);

  // Evolução dos últimos 30 dias — abertos x solucionados por dia.
  const evolution = useMemo(() => {
    const days: { dia: string; abertos: number; solucionados: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      days.push({
        dia: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        abertos: tickets.filter((t) => t.created_at.slice(0, 10) === key).length,
        solucionados: tickets.filter((t) => t.resolved_at?.slice(0, 10) === key).length,
      });
    }
    return days;
  }, [tickets]);

  const recent = tickets.slice(0, 8);

  return (
    <AppShell
      title="Painel"
      subtitle="Visão geral da central de serviços"
      actions={
        <Button size="sm" className="h-8" asChild>
          <Link to="/chamados/novo">
            <Plus className="size-4" /> Criar chamado
          </Link>
        </Button>
      }
    >
      {/* Contadores por status */}
      <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {counters.map((c) => (
          <Link
            key={c.status}
            to="/chamados"
            search={{ status: c.status }}
            className="panel px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${STATUS_DOT[c.status]}`} />
              {c.label}
            </span>
            <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
          </Link>
        ))}
        <Link
          to="/chamados"
          search={{ filtro: "atrasados" }}
          className="panel border-destructive/40 px-3 py-2.5 transition-colors hover:bg-destructive/10"
        >
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="size-3.5" />
            SLA estourado
          </span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{late.length}</p>
        </Link>
      </div>

      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Chamados por categoria">
          <ChartBox>
            <BarChart data={byCategory} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={52}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <ChartTooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="total" name="Chamados" radius={[2, 2, 0, 0]}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </Panel>

        <Panel title="Carga por técnico (em aberto)">
          <ChartBox>
            <BarChart
              data={byTechnician}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="total" name="Em aberto" fill="var(--chart-1)" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ChartBox>
        </Panel>

        <Panel title="Últimos 30 dias">
          <ChartBox>
            <LineChart data={evolution} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                interval={4}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <ChartTooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="abertos"
                name="Abertos"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="solucionados"
                name="Solucionados"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartBox>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Panel title="Chamados recentes">
          <div className="overflow-x-auto">
            <table className="glpi-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {ticketsQuery.isLoading && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!ticketsQuery.isLoading && recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhum chamado registrado ainda.
                    </td>
                  </tr>
                )}
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-[0.72rem] text-muted-foreground">
                      {ticketCode(t.id)}
                    </td>
                    <td className="max-w-[320px]">
                      <Link
                        to="/chamados/$id"
                        params={{ id: t.id }}
                        className="block truncate font-medium text-primary hover:underline"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${STATUS_DOT[t.status]}`} />
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {relativeTime(t.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Indicadores">
            <dl className="divide-y divide-border text-xs">
              <Indicator label="Total de chamados" value={String(tickets.length)} />
              <Indicator
                label="Em aberto"
                value={String(tickets.filter((t) => isOpenStatus(t.status)).length)}
              />
              <Indicator
                label="Tempo médio de solução"
                value={avgHours === null ? "—" : `${avgHours.toFixed(1)} h`}
              />
              <Indicator label="Com SLA estourado" value={String(late.length)} />
            </dl>
          </Panel>

          <Panel title="Atrasados">
            {late.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Nenhum chamado fora do prazo.</p>
            ) : (
              <ul className="divide-y divide-border">
                {late.slice(0, 6).map((t) => (
                  <li key={t.id} className="px-3 py-2">
                    <Link
                      to="/chamados/$id"
                      params={{ id: t.id }}
                      className="block truncate text-xs font-medium text-primary hover:underline"
                    >
                      {t.title}
                    </Link>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Aberto em {formatDate(t.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">{title}</header>
      {children}
    </section>
  );
}

function ChartBox({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-[220px] w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
