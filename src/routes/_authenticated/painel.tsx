import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Inbox, Timer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de chamados — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Acompanhe métricas, filas e o andamento de todos os chamados de suporte de T.I. em um só painel.",
      },
      { property: "og:title", content: "Painel de chamados — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Métricas e fila completa dos chamados de suporte de T.I.",
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
  resolved_at: string | null;
  requester_id: string;
  assignee_id: string | null;
};

function Painel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("todos");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,title,category,status,priority,created_at,resolved_at,requester_id,assignee_id")
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

  const tickets = ticketsQuery.data ?? [];

  const metrics = useMemo(() => {
    const open = tickets.filter((t) => t.status === "aberto").length;
    const progress = tickets.filter((t) => t.status === "em_andamento").length;
    const solved = tickets.filter((t) => t.status === "resolvido" || t.status === "fechado");
    const critical = tickets.filter(
      (t) => t.priority === "critica" && t.status !== "resolvido" && t.status !== "fechado",
    ).length;
    const durations = solved
      .filter((t) => t.resolved_at)
      .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
    const avgHours = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000
      : null;
    return { open, progress, solved: solved.length, critical, avgHours };
  }, [tickets]);

  const filtered = tickets.filter((t) => {
    const matchStatus = status === "todos" || t.status === status;
    const term = search.trim().toLowerCase();
    const matchTerm =
      !term || t.title.toLowerCase().includes(term) || ticketCode(t.id).toLowerCase().includes(term);
    return matchStatus && matchTerm;
  });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Painel de chamados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da fila de suporte técnico.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={<Inbox className="size-4" />} label="Abertos" value={metrics.open} />
        <Metric icon={<Clock className="size-4" />} label="Em andamento" value={metrics.progress} />
        <Metric
          icon={<CheckCircle2 className="size-4" />}
          label="Resolvidos"
          value={metrics.solved}
        />
        <Metric
          icon={<AlertTriangle className="size-4" />}
          label="Críticos abertos"
          value={metrics.critical}
        />
        <Metric
          icon={<Timer className="size-4" />}
          label="Tempo médio"
          value={metrics.avgHours === null ? "—" : `${metrics.avgHours.toFixed(1)} h`}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou código..."
          className="sm:max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {ticketsQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando chamados...</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum chamado encontrado.</p>
            <Link
              to="/chamados/novo"
              className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
            >
              Abrir o primeiro chamado
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link
                  to="/chamados/$id"
                  params={{ id: t.id }}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/60 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticketCode(t.id)}
                      </span>
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.category} · aberto em {formatDate(t.created_at)} ·{" "}
                      {t.assignee_id
                        ? `resp. ${nameById.get(t.assignee_id) ?? "—"}`
                        : "sem responsável"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Tag className={PRIORITY_CLASS[t.priority]}>{PRIORITY_LABEL[t.priority]}</Tag>
                    <Tag className={STATUS_CLASS[t.status]}>{STATUS_LABEL[t.status]}</Tag>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
