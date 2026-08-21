import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Cable,
  Cpu,
  HardDrive,
  Laptop,
  Monitor,
  Network,
  Package,
  Plug,
  Printer,
  Server,
  Smartphone,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DashboardSelector } from "@/components/DashboardSelector";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { ASSET_KIND_LABEL, type AssetKind } from "@/lib/glpi";

export const Route = createFileRoute("/_authenticated/inventario/painel")({
  head: () => ({
    meta: [
      { title: "Painel de ativos — Helpdesk T.I." },
      {
        name: "description",
        content: "Quantos equipamentos de cada tipo, por fabricante e por situação.",
      },
    ],
  }),
  component: PainelDeAtivos,
});

/**
 * Os blocos do painel de ativos do GLPI, na ordem em que ele os mostra.
 * Cada um leva para a lista já filtrada, como no original.
 */
const BLOCOS: { kind: AssetKind; icone: typeof Laptop; matiz: string }[] = [
  { kind: "computador", matiz: "tile-info", icone: Cpu },
  { kind: "notebook", matiz: "tile-primary", icone: Laptop },
  { kind: "monitor", matiz: "tile-danger", icone: Monitor },
  { kind: "impressora", matiz: "tile-purple", icone: Printer },
  { kind: "rede", matiz: "tile-success", icone: Network },
  { kind: "telefonia", matiz: "tile-warning", icone: Smartphone },
  { kind: "rack", matiz: "tile-muted", icone: Server },
  { kind: "periferico", matiz: "tile-info", icone: Package },
  { kind: "pdu", matiz: "tile-warning", icone: Plug },
  { kind: "cabo", matiz: "tile-muted", icone: Cable },
  { kind: "gabinete", matiz: "tile-success", icone: HardDrive },
];

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function PainelDeAtivos() {
  const { can } = usePermissions();

  const ativos = useQuery({
    queryKey: ["assets_painel"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("assets")
        .select("id,kind,status,manufacturer_id,model_id,state_id")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const fabricantes = useQuery({
    queryKey: ["manufacturers"],
    queryFn: async () => {
      const { data } = await looseDb.from("manufacturers").select("id,name").order("name");
      return data ?? [];
    },
  });

  const situacoes = useQuery({
    queryKey: ["asset_states"],
    queryFn: async () => {
      const { data } = await looseDb.from("asset_states").select("id,name").order("name");
      return data ?? [];
    },
  });

  const linhas = (ativos.data ?? []) as LooseRow[];

  const contar = (kind: AssetKind) => linhas.filter((a) => a["kind"] === kind).length;

  /** Agrupa por uma chave estrangeira, resolvendo o nome pela lista de apoio. */
  const agrupar = (campo: string, apoio: LooseRow[] | undefined, semNome: string) => {
    const nomes = new Map((apoio ?? []).map((r) => [r.id, String(r["name"])]));
    const mapa = new Map<string, number>();
    for (const a of linhas) {
      const id = a[campo];
      const nome = id ? (nomes.get(String(id)) ?? semNome) : semNome;
      mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  };

  const porFabricante = useMemo(
    () => agrupar("manufacturer_id", fabricantes.data as LooseRow[] | undefined, "Sem fabricante"),
    [linhas, fabricantes.data],
  );

  const porSituacao = useMemo(
    () => agrupar("state_id", situacoes.data as LooseRow[] | undefined, "Sem situação"),
    [linhas, situacoes.data],
  );

  if (!can("computer", "read")) {
    return (
      <AppShell title="Painel de ativos">
        <div className="panel p-8 text-center text-xs text-muted-foreground">
          Seu perfil não tem acesso ao inventário.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Painel de ativos"
      subtitle="Quantos equipamentos de cada tipo, e como o parque se distribui."
      breadcrumbTail="Painel de ativos"
      actions={<DashboardSelector atual="ativos" />}
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {BLOCOS.map((b) => {
          const Icone = b.icone;
          return (
            <Link
              key={b.kind}
              to="/inventario"
              search={{ tipo: b.kind }}
              className={`tile ${b.matiz}`}
            >
              <Icone className="tile-icon size-8" aria-hidden="true" />
              <span className="tile-number">{contar(b.kind)}</span>
              <span className="tile-label">{ASSET_KIND_LABEL[b.kind]}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Grafico titulo="Ativos por fabricante" dados={porFabricante} />
        <Grafico titulo="Ativos por situação" dados={porSituacao} />
      </div>

      {linhas.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Nenhum ativo cadastrado ainda. Os números aparecem conforme o parque for lançado.
        </p>
      )}
    </AppShell>
  );
}

/** Barras horizontais, o formato que o GLPI usa nos cards de contagem. */
function Grafico({ titulo, dados }: { titulo: string; dados: { name: string; total: number }[] }) {
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
              width={110}
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
