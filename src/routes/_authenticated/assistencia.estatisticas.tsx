import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { slaState } from "@/lib/glpi";
import { STATUS_LABEL, STATUS_ORDER, type TicketStatus } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — Helpdesk T.I." },
      {
        name: "description",
        content: "Volume, tempo de solução e cumprimento de SLA no período escolhido.",
      },
    ],
  }),
  component: Estatisticas,
});

type Chamado = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_due_at: string | null;
  assignee_id: string | null;
};

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 3 meses" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
];

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Estatisticas() {
  const { can } = usePermissions();
  const acesso = useAcesso("statistics");
  const [periodo, setPeriodo] = useState("90");

  const chamados = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at");
      if (error) throw error;
      return data as unknown as Chamado[];
    },
  });

  const dias = Number(periodo);
  const corte = useMemo(() => Date.now() - dias * 86_400_000, [dias]);

  const noPeriodo = useMemo(
    () => (chamados.data ?? []).filter((t) => new Date(t.created_at).getTime() >= corte),
    [chamados.data, corte],
  );

  /** Tempo médio entre abertura e solução, em horas. */
  const tempoMedio = useMemo(() => {
    const durações = noPeriodo
      .filter((t) => t.resolved_at)
      .map((t) => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
    if (durações.length === 0) return null;
    return durações.reduce((a, b) => a + b, 0) / durações.length / 3_600_000;
  }, [noPeriodo]);

  const dentroDoPrazo = useMemo(() => {
    const comPrazo = noPeriodo.filter((t) => t.resolution_due_at);
    if (comPrazo.length === 0) return null;
    const atrasados = comPrazo.filter(
      (t) => slaState(t.resolution_due_at, t.resolved_at, t.status === "fechado").late,
    ).length;
    return Math.round(((comPrazo.length - atrasados) / comPrazo.length) * 100);
  }, [noPeriodo]);

  const porStatus = useMemo(
    () =>
      STATUS_ORDER.map((s) => ({
        name: STATUS_LABEL[s],
        total: noPeriodo.filter((t) => t.status === s).length,
      })).filter((r) => r.total > 0),
    [noPeriodo],
  );

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of noPeriodo) mapa.set(t.category || "Sem categoria", (mapa.get(t.category || "Sem categoria") ?? 0) + 1);
    return [...mapa.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [noPeriodo]);

  /** Evolução por mês: abertos contra solucionados, em áreas, como no GLPI. */
  const evolucao = useMemo(() => {
    const meses = new Map<string, { mes: string; abertos: number; solucionados: number }>();
    const chave = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (let i = Math.floor(dias / 30); i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      meses.set(chave(d), {
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        abertos: 0,
        solucionados: 0,
      });
    }
    for (const t of noPeriodo) {
      const a = meses.get(chave(new Date(t.created_at)));
      if (a) a.abertos++;
      if (t.resolved_at) {
        const s = meses.get(chave(new Date(t.resolved_at)));
        if (s) s.solucionados++;
      }
    }
    return [...meses.values()];
  }, [noPeriodo, dias]);

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="Estatísticas" estado={acesso} mensagem="Seu perfil não tem acesso às estatísticas." />;
  }

  return (
    <AppShell
      title="Estatísticas"
      subtitle="Volume, tempo de solução e cumprimento de prazo no período."
      breadcrumbTail="Estatísticas"
      actions={
        <div className="flex items-center gap-2">
          <Label className="text-[0.72rem] text-muted-foreground">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tile tile-info">
          <span className="tile-number">{noPeriodo.length}</span>
          <span className="tile-label">Chamados abertos no período</span>
        </div>
        <div className="tile tile-success">
          <span className="tile-number">{noPeriodo.filter((t) => t.resolved_at).length}</span>
          <span className="tile-label">Solucionados</span>
        </div>
        <div className="tile tile-primary">
          <span className="tile-number">{tempoMedio === null ? "—" : tempoMedio.toFixed(1)}</span>
          <span className="tile-label">Horas até a solução, em média</span>
        </div>
        <div className={`tile ${dentroDoPrazo !== null && dentroDoPrazo < 80 ? "tile-danger" : "tile-success"}`}>
          <span className="tile-number">{dentroDoPrazo === null ? "—" : `${dentroDoPrazo}%`}</span>
          <span className="tile-label">Dentro do prazo de SLA</span>
        </div>
      </div>

      <div className="mb-3 panel overflow-hidden">
        <header className="panel-header">Evolução no período</header>
        <div className="h-72 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucao} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <ChartTooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: "0.75rem",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
              <Area
                type="monotone"
                dataKey="abertos"
                name="Abertos"
                stackId="1"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="solucionados"
                name="Solucionados"
                stackId="2"
                stroke="var(--chart-2)"
                fill="var(--chart-2)"
                fillOpacity={0.25}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Barras titulo="Por situação" dados={porStatus} />
        <Barras titulo="Cinco categorias com mais chamados" dados={porCategoria} />
      </div>

      {noPeriodo.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Nenhum chamado no período escolhido.
        </p>
      )}
    </AppShell>
  );
}

function Barras({ titulo, dados }: { titulo: string; dados: { name: string; total: number }[] }) {
  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">{titulo}</header>
      <div className="h-64 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <ChartTooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "0.75rem",
              }}
            />
            <Bar dataKey="total" radius={[0, 3, 3, 0]}>
              {dados.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
