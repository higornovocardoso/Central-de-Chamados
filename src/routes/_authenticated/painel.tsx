import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CircleCheck,
  Clock,
  Maximize,
  Plus,
  RefreshCw,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DashboardSelector } from "@/components/DashboardSelector";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { slaState } from "@/lib/glpi";
import {
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

/** Cor de cada status nas etiquetas do topo. */
const STATUS_PILL: Record<TicketStatus, string> = {
  aberto: "pill-info",
  em_andamento: "pill-primary",
  planejado: "pill-purple",
  aguardando: "pill-warning",
  resolvido: "pill-success",
  fechado: "pill-muted",
};

const PRIORITY_PILL: Record<TicketPriority, string> = {
  baixa: "pill-muted",
  media: "pill-info",
  alta: "pill-warning",
  critica: "pill-danger",
};

const PRIORITY_HUE: Record<TicketPriority, string> = {
  baixa: "var(--muted-foreground)",
  media: "var(--info)",
  alta: "var(--warning)",
  critica: "var(--destructive)",
};

function Painel() {
  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
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

  const open = useMemo(() => tickets.filter((t) => isOpenStatus(t.status)), [tickets]);

  const avgHours = useMemo(() => {
    const durations = tickets
      .filter((t) => t.resolved_at)
      .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000;
  }, [tickets]);

  const solvedRate = useMemo(() => {
    if (tickets.length === 0) return 0;
    const solved = tickets.filter((t) => t.status === "resolvido" || t.status === "fechado").length;
    return Math.round((solved / tickets.length) * 100);
  }, [tickets]);

  const slaRate = useMemo(() => {
    if (tickets.length === 0) return 100;
    return Math.round(((tickets.length - late.length) / tickets.length) * 100);
  }, [tickets, late]);

  const byPriority = useMemo(() => {
    const order: TicketPriority[] = ["critica", "alta", "media", "baixa"];
    return order.map((priority) => ({
      priority,
      label: PRIORITY_LABEL[priority],
      value: tickets.filter((t) => t.priority === priority).length,
    }));
  }, [tickets]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [tickets]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of open) {
      const key = t.assignee_id ? (nameById.get(t.assignee_id) ?? "—") : "Não atribuído";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [open, nameById]);

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

  function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  const critical = useMemo(
    () =>
      [...tickets]
        .filter(
          (t) =>
            isOpenStatus(t.status) &&
            (t.priority === "critica" ||
              t.priority === "alta" ||
              slaState(t.resolution_due_at, t.resolved_at, false).late),
        )
        .slice(0, 6),
    [tickets],
  );

  const recent = tickets.slice(0, 6);
  const maxTech = Math.max(1, ...byTechnician.map((t) => t.total));
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.total));

  return (
    <AppShell
      title="Painel"
      subtitle="Visão geral da central de serviços"
      actions={
        <div className="flex items-center gap-1">
          <DashboardSelector atual="assistencia" />
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-full"
            title="Atualizar"
            aria-label="Atualizar"
            onClick={() => ticketsQuery.refetch()}
          >
            <RefreshCw className={`size-4 ${ticketsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-full"
            title="Tela cheia"
            aria-label="Tela cheia"
            onClick={toggleFullscreen}
          >
            <Maximize className="size-4" />
          </Button>
          <Button size="sm" className="ml-1 h-8 rounded-full" asChild>
            <Link to="/chamados/novo">
              <Plus className="size-4" /> Criar chamado
            </Link>
          </Button>
        </div>
      }
    >
      {/* Faixa de etiquetas: status dos chamados e situação de SLA */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel rise-in flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-1 text-sm font-semibold">Status dos chamados</span>
          {counters.map((c) => (
            <Link
              key={c.status}
              to="/chamados"
              search={{ status: c.status }}
              className={`pill ${STATUS_PILL[c.status]}`}
            >
              <span className="font-semibold tabular-nums">{String(c.value).padStart(2, "0")}</span>
              {c.label}
            </Link>
          ))}
        </section>
        <section
          className="panel rise-in flex flex-wrap items-center gap-2 px-4 py-3"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          <span className="mr-1 text-sm font-semibold">Situação do SLA</span>
          <Link to="/chamados" search={{ filtro: "atrasados" }} className="pill pill-danger">
            <span className="font-semibold tabular-nums">
              {String(late.length).padStart(2, "0")}
            </span>
            Atrasados
          </Link>
          <span className="pill pill-success">
            <span className="font-semibold tabular-nums">{slaRate}%</span> No prazo
          </span>
        </section>
      </div>

      {/* Indicadores principais */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          hue="tile-info"
          icon={Activity}
          value={String(open.length)}
          label="Chamados em aberto"
          delay={0}
          to="/chamados"
        />
        <Kpi
          hue="tile-danger"
          icon={TriangleAlert}
          value={String(late.length)}
          label="Fora do prazo (SLA)"
          delay={70}
          to="/chamados"
        />
        <Kpi
          hue="tile-success"
          icon={CircleCheck}
          value={`${solvedRate}%`}
          label="Taxa de solução"
          delay={140}
        />
        <Kpi
          hue="tile-primary"
          icon={Timer}
          value={avgHours === null ? "—" : `${avgHours.toFixed(1)}h`}
          label="Tempo médio de solução"
          delay={210}
        />
      </div>

      {/* Anéis de desempenho + chamados críticos */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Panel title="Desempenho" hint={`${tickets.length} chamados no total`} delay={0}>
          <div className="grid grid-cols-2 gap-4 p-4 pt-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Ring value={slaRate} label="SLA cumprido" color="var(--chart-2)" />
            <Ring value={solvedRate} label="Solucionados" color="var(--success)" />
            <Ring
              value={tickets.length ? Math.round((open.length / tickets.length) * 100) : 0}
              label="Em aberto"
              color="var(--chart-1)"
            />
            <Ring
              value={
                tickets.length
                  ? Math.round(
                      (tickets.filter((t) => t.priority === "critica" || t.priority === "alta")
                        .length /
                        tickets.length) *
                        100,
                    )
                  : 0
              }
              label="Alta prioridade"
              color="var(--destructive)"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            {byPriority.map((p) => (
              <span key={p.priority} className={`pill ${PRIORITY_PILL[p.priority]}`}>
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: PRIORITY_HUE[p.priority] }}
                />
                {p.label}
                <span className="font-semibold tabular-nums">{p.value}</span>
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Chamados críticos e atrasados" hint="Prioridade alta ou SLA vencido" delay={80}>
          <div className="overflow-x-auto">
            <table className="glpi-table">
              <thead>
                <tr>
                  <th>Chamado</th>
                  <th>Responsável</th>
                  <th>Prioridade</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {critical.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Nenhum chamado crítico no momento.
                    </td>
                  </tr>
                )}
                {critical.map((t) => {
                  const sla = slaState(t.resolution_due_at, t.resolved_at, false);
                  return (
                    <tr key={t.id}>
                      <td className="max-w-[260px]">
                        <Link
                          to="/chamados/$id"
                          params={{ id: t.id }}
                          className="block truncate font-medium hover:text-link hover:underline"
                        >
                          {t.title}
                        </Link>
                        <span className="font-mono text-[0.68rem] text-muted-foreground">
                          {ticketCode(t.id)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {t.assignee_id ? (nameById.get(t.assignee_id) ?? "—") : "Não atribuído"}
                      </td>
                      <td>
                        <span className={`pill ${PRIORITY_PILL[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${sla.late ? "pill-danger" : "pill-success"}`}>
                          <Clock className="size-3" />
                          {t.resolution_due_at ? formatDate(t.resolution_due_at) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Evolução + distribuições */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Últimos 30 dias" hint="Abertos x solucionados" delay={0}>
          <div className="h-[240px] w-full p-3 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="gAbertos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSolucionados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <ChartTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 12px 30px -18px rgb(19 26 43 / 60%)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="abertos"
                  name="Abertos"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#gAbertos)"
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="solucionados"
                  name="Solucionados"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  fill="url(#gSolucionados)"
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Chamados por categoria" hint="Top 6" delay={80}>
          <div className="space-y-3 p-4 pt-2">
            {byCategory.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
            )}
            {byCategory.map((c, i) => (
              <BarRow
                key={c.name}
                name={c.name}
                value={c.total}
                percent={(c.total / maxCategory) * 100}
                color={`var(--chart-${(i % 5) + 1})`}
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* Equipe + recentes */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Carga por técnico" hint="Chamados em aberto" delay={0}>
          <div className="space-y-3 p-4 pt-2">
            {byTechnician.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum chamado em aberto.</p>
            )}
            {byTechnician.map((t) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-foreground">
                  {initials(t.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{t.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{t.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${(t.total / maxTech) * 100}%`,
                        background: "linear-gradient(90deg, var(--chart-1), var(--chart-3))",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Chamados recentes" hint={<Users className="size-4 opacity-50" />} delay={80}>
          <div className="overflow-x-auto">
            <table className="glpi-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {ticketsQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!ticketsQuery.isLoading && recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
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
                        className="block truncate font-medium hover:text-link hover:underline"
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
                    <td className="whitespace-nowrap text-muted-foreground">
                      {relativeTime(t.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Kpi({
  hue,
  icon: Icon,
  value,
  label,
  delay,
  to,
}: {
  hue: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  delay: number;
  to?: string;
}) {
  const content = (
    <>
      <Icon className="tile-icon size-5" aria-hidden="true" />
      <span className="tile-number">{value}</span>
      <span className="tile-label">{label}</span>
    </>
  );
  const style = { "--d": `${delay}ms` } as React.CSSProperties;
  if (to) {
    return (
      <Link to={to} className={`tile rise-in ${hue}`} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={`tile rise-in ${hue}`} style={style}>
      {content}
    </div>
  );
}

/** Anel de percentual, no estilo dos gráficos circulares do exemplo. */
function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
          <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle
            className="ring-animated"
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ "--ring-circumference": circumference } as React.CSSProperties}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
          {value}%
        </span>
      </div>
      <span className="text-center text-[0.7rem] text-muted-foreground">{label}</span>
    </div>
  );
}

function BarRow({
  name,
  value,
  percent,
  color,
}: {
  name: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{name}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  delay = 0,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="panel rise-in overflow-hidden"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <header className="panel-header justify-between">
        <span>{title}</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </header>
      {children}
    </section>
  );
}
