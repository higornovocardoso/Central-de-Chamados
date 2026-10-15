import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, CircleCheck, CircleHelp, Inbox, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useCountUp } from "@/hooks/useCountUp";
import {
  PRAZO_COR,
  PRAZO_TEXTO,
  duracao,
  emAtendimento,
  porPrazo,
  prazoCurto,
  prazoDe,
  relogio,
  useAgora,
} from "@/lib/prazo";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOpenStatus,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel" },
      {
        name: "description",
        content:
          "O que precisa de atenção agora: prazos, fila sem técnico, carga da equipe e o chamado que você está atendendo.",
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
  resolution_due_at: string | null;
  requester_id: string | null;
  reporter_name: string;
  reporter_sector: string;
  assignee_id: string | null;
};

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
] as const;

const PRIORITY_RANK: Record<TicketPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
const DIA = 86_400_000;

function inicioDoDia(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Painel() {
  const queryClient = useQueryClient();
  const { user, can } = usePermissions();
  const [periodo, setPeriodo] = useState<number>(30);
  const agora = useAgora(30_000);

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,title,category,status,priority,created_at,resolved_at,resolution_due_at,requester_id,reporter_name,reporter_sector,assignee_id",
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TicketRow[];
    },
    refetchInterval: 60_000,
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email");
      if (error) throw error;
      return data;
    },
  });

  const nomeDe = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilesQuery.data ?? []) map.set(p.id, p.full_name || p.email);
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "Sem técnico");
  }, [profilesQuery.data]);

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const abertos = useMemo(() => tickets.filter((t) => isOpenStatus(t.status)), [tickets]);
  const estourados = abertos.filter((t) => prazoDe(t, agora).estado === "late");

  // Fila: sem técnico, quem estoura antes primeiro; no empate, a prioridade.
  const fila = useMemo(
    () =>
      abertos
        .filter((t) => !t.assignee_id)
        .sort((a, b) => porPrazo(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [abertos],
  );

  const atendendo = useMemo(() => emAtendimento(abertos, user?.id), [abertos, user?.id]);

  const proximos = useMemo(
    () =>
      abertos
        .filter((t) => t.id !== atendendo?.id)
        .sort((a, b) => porPrazo(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        .slice(0, 6),
    [abertos, atendendo?.id],
  );

  // Série diária do período: abertos e solucionados por dia.
  const serie = useMemo(() => {
    const hoje = inicioDoDia(Date.now());
    const dias: { dia: number; abertos: number; solucionados: number }[] = [];
    for (let i = periodo - 1; i >= 0; i--) {
      const ini = hoje - i * DIA;
      const fim = ini + DIA;
      dias.push({
        dia: ini,
        abertos: tickets.filter((t) => {
          const c = new Date(t.created_at).getTime();
          return c >= ini && c < fim;
        }).length,
        solucionados: tickets.filter((t) => {
          if (!t.resolved_at) return false;
          const r = new Date(t.resolved_at).getTime();
          return r >= ini && r < fim;
        }).length,
      });
    }
    return dias;
  }, [tickets, periodo]);

  // Quantos estavam em aberto no fim de cada um dos últimos 14 dias.
  const historico = useMemo(() => {
    const hoje = inicioDoDia(Date.now());
    return Array.from({ length: 14 }, (_, k) => {
      const fim = hoje - (13 - k) * DIA + DIA;
      let emAberto = 0;
      let atrasados = 0;
      for (const t of tickets) {
        const criado = new Date(t.created_at).getTime();
        const resolvido = t.resolved_at ? new Date(t.resolved_at).getTime() : Infinity;
        if (criado < fim && resolvido >= fim && t.status !== "fechado") {
          emAberto++;
          if (t.resolution_due_at && new Date(t.resolution_due_at).getTime() < fim) atrasados++;
        }
      }
      return { emAberto, atrasados };
    });
  }, [tickets]);

  const desde = Date.now() - periodo * DIA;
  const resolvidosNoPeriodo = tickets.filter(
    (t) => t.resolved_at && new Date(t.resolved_at).getTime() >= desde,
  );
  const noPrazo = resolvidosNoPeriodo.filter(
    (t) => !t.resolution_due_at || t.resolved_at! <= t.resolution_due_at,
  ).length;
  const taxaNoPrazo = resolvidosNoPeriodo.length
    ? Math.round((noPrazo / resolvidosNoPeriodo.length) * 100)
    : null;
  const mediaSolucaoMs = resolvidosNoPeriodo.length
    ? resolvidosNoPeriodo.reduce(
        (s, t) => s + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()),
        0,
      ) / resolvidosNoPeriodo.length
    : null;

  const novosHoje = tickets.filter(
    (t) => new Date(t.created_at).getTime() >= inicioDoDia(Date.now()),
  ).length;
  const maisAntigoEstourado = [...estourados].sort(porPrazo)[0];
  const maisAntigoNaFila = [...fila].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  const carga = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of abertos) {
      if (!t.assignee_id) continue;
      map.set(t.assignee_id, (map.get(t.assignee_id) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [abertos]);

  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) {
      if (new Date(t.created_at).getTime() < desde) continue;
      const nome = t.category || "Sem categoria";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    }
    const lista = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = lista.slice(0, 5);
    const resto = lista.slice(5).reduce((s, [, n]) => s + n, 0);
    return resto > 0 ? [...top, ["Outras", resto] as [string, number]] : top;
  }, [tickets, desde]);

  const podeAtender = can("ticket", "update") && Boolean(user);

  const chamar = useMutation({
    mutationFn: async () => {
      // Confere no banco, e não na lista em memória, se o primeiro da fila
      // continua livre: outro técnico pode ter chamado no mesmo instante.
      for (const candidato of fila.slice(0, 5)) {
        const { data: atual, error } = await supabase
          .from("tickets")
          .select("assignee_id,status")
          .eq("id", candidato.id)
          .single();
        if (error) throw error;
        if (atual.assignee_id) continue;

        const { data: ator, error: atorError } = await db
          .from("ticket_actors")
          .insert({ ticket_id: candidato.id, role: "atribuido", user_id: user!.id } as never)
          .select("id")
          .single();
        if (atorError) throw new Error(atorError.message);

        const statusAnterior = atual.status as TicketStatus;
        if (statusAnterior === "aberto") {
          const { error: stError } = await supabase
            .from("tickets")
            .update({ status: "em_andamento" } as never)
            .eq("id", candidato.id);
          if (stError) throw stError;
        }
        return { ticket: candidato, atorId: (ator as { id: string }).id, statusAnterior };
      }
      throw new Error("Os chamados da fila acabaram de ser assumidos por outros técnicos.");
    },
    onSuccess: (r) => {
      atualizar();
      toast.success(`Você assumiu ${ticketCode(r.ticket.id)}`, {
        description: r.ticket.title,
        action: { label: "Desfazer", onClick: () => desfazer.mutate(r) },
      });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível chamar o próximo", { description: e.message }),
  });

  const desfazer = useMutation({
    mutationFn: async (r: { ticket: TicketRow; atorId: string; statusAnterior: TicketStatus }) => {
      const { error } = await db.from("ticket_actors").delete().eq("id", r.atorId);
      if (error) throw new Error(error.message);
      if (r.statusAnterior === "aberto") {
        await supabase
          .from("tickets")
          .update({ status: "aberto" } as never)
          .eq("id", r.ticket.id);
      }
    },
    onSuccess: () => {
      atualizar();
      toast("Chamado devolvido para a fila.");
    },
    onError: (e: Error) => toast.error("Não foi possível desfazer", { description: e.message }),
  });

  function atualizar() {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["nav_counts"] });
  }

  const primeiroNome =
    ((user?.user_metadata?.["full_name"] as string | undefined) ?? "").split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const resumo =
    estourados.length === 0 && fila.length === 0
      ? "Nenhum chamado fora do prazo e ninguém esperando técnico."
      : `${plural(estourados.length, "chamado passou", "chamados passaram")} do prazo e ${plural(
          fila.length,
          "espera",
          "esperam",
        )} um técnico.`;

  const carregando = ticketsQuery.isLoading;

  return (
    <AppShell>
      <div className="reveal flex flex-col gap-5">
        <div
          style={{ "--i": 0 } as CSSProperties}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {hoje}
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]">
              {saudacao}
              {primeiroNome ? `, ${primeiroNome}` : ""}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <span className="live-dot" /> Ao vivo
              </span>
              {carregando ? "Carregando a fila…" : resumo}
            </p>
          </div>
          <Segmented
            value={periodo}
            options={PERIODOS.map((p) => ({ value: p.dias, label: p.label }))}
            onChange={setPeriodo}
          />
        </div>

        <div
          style={{ "--i": 1 } as CSSProperties}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Kpi
            icon={Inbox}
            hue="var(--primary)"
            label="Em aberto"
            value={abertos.length}
            to="/chamados"
            search={{ filtro: "abertos" }}
            visual={<Sparkline values={historico.map((h) => h.emAberto)} color="var(--primary)" />}
            foot={
              novosHoje > 0 ? (
                <>
                  <b className="font-medium text-foreground">+{novosHoje}</b>{" "}
                  {novosHoje === 1 ? "novo" : "novos"} hoje
                </>
              ) : (
                "nenhum novo hoje"
              )
            }
          />
          <Kpi
            icon={TriangleAlert}
            hue="var(--destructive)"
            label="Prazo estourado"
            value={estourados.length}
            bad={estourados.length > 0}
            to="/chamados"
            search={{ filtro: "atrasados" }}
            visual={
              <Sparkline values={historico.map((h) => h.atrasados)} color="var(--destructive)" />
            }
            foot={
              maisAntigoEstourado
                ? `o mais antigo passou há ${duracao(prazoDe(maisAntigoEstourado, agora).restanteMs ?? 0)}`
                : "nenhum agora"
            }
          />
          <Kpi
            icon={CircleHelp}
            hue="var(--info)"
            label="Sem técnico"
            value={fila.length}
            to="/chamados"
            search={{ filtro: "nao_atribuidos" }}
            visual={
              <Meter
                value={abertos.length ? fila.length / abertos.length : 0}
                color="var(--info)"
              />
            }
            foot={
              maisAntigoNaFila
                ? `o mais antigo espera há ${duracao(agora - new Date(maisAntigoNaFila.created_at).getTime())}`
                : "todos com técnico"
            }
          />
          <Kpi
            icon={CircleCheck}
            hue="var(--success)"
            label="Solucionados no prazo"
            value={taxaNoPrazo ?? 0}
            suffix={taxaNoPrazo === null ? undefined : "%"}
            placeholder={taxaNoPrazo === null ? "—" : undefined}
            visual={<Meter value={(taxaNoPrazo ?? 0) / 100} color="var(--success)" />}
            foot={
              mediaSolucaoMs === null
                ? `nenhum solucionado em ${periodo} dias`
                : `${resolvidosNoPeriodo.length} em ${periodo} dias · média de ${duracao(mediaSolucaoMs)}`
            }
          />
        </div>

        <div
          style={{ "--i": 2 } as CSSProperties}
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
        >
          <div className="flex min-w-0 flex-col gap-4">
            <Atendendo
              ticket={atendendo}
              fila={fila.slice(0, 3)}
              podeAtender={podeAtender}
              chamando={chamar.isPending}
              onChamar={() => chamar.mutate()}
            />

            <section className="panel overflow-hidden">
              <header className="panel-header justify-between">
                <span>Fila por prazo</span>
                <Link
                  to="/chamados"
                  search={{ filtro: "abertos" } as never}
                  className="group inline-flex items-center gap-1 text-[0.8125rem] font-medium text-primary"
                >
                  Ver todos
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </header>
              {proximos.length === 0 && (
                <p className="px-5 py-8 text-center text-[0.8125rem] text-muted-foreground">
                  {carregando ? "Carregando…" : "Nenhum outro chamado em aberto."}
                </p>
              )}
              <ul>
                {proximos.map((t, k) => {
                  const p = prazoDe(t, agora);
                  return (
                    <li key={t.id} className="border-b border-border last:border-b-0">
                      <Link
                        to="/chamados/$id"
                        params={{ id: t.id }}
                        className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3 px-[1.125rem] py-2.5 transition-colors hover:bg-hover sm:grid-cols-[5.5rem_minmax(0,1fr)_8.5rem]"
                      >
                        <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                          {ticketCode(t.id)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{t.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {nomeDe(t.assignee_id)} · {STATUS_LABEL[t.status]} · {t.category}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1.5">
                          <span
                            className={`text-xs font-medium tabular-nums ${PRAZO_TEXTO[p.estado]}`}
                          >
                            {prazoCurto(p)}
                          </span>
                          <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <span
                              className="bar-grow block h-full rounded-full"
                              style={
                                {
                                  width: `${Math.max(6, p.usado * 100)}%`,
                                  background: PRAZO_COR[p.estado],
                                  "--d": `${250 + k * 60}ms`,
                                } as CSSProperties
                              }
                            />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section className="panel overflow-hidden">
              <header className="panel-header justify-between">
                <span>Carga por técnico</span>
                <span className="text-xs font-normal text-muted-foreground">em aberto</span>
              </header>
              <div className="flex flex-col gap-3 p-[1.125rem]">
                {carga.length === 0 && fila.length === 0 && (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Nenhum chamado em aberto.
                  </p>
                )}
                {(() => {
                  const max = Math.max(1, fila.length, ...carga.map((c) => c.total));
                  const linhas = [
                    ...carga.map((c) => ({
                      key: c.id,
                      nome: nomeDe(c.id),
                      total: c.total,
                      eu: c.id === user?.id,
                    })),
                    ...(fila.length
                      ? [{ key: "fila", nome: "Sem técnico", total: fila.length, eu: false }]
                      : []),
                  ];
                  return linhas.map((l, k) => (
                    <div
                      key={l.key}
                      className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_1.5rem] items-center gap-3 text-[0.8125rem]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Iniciais nome={l.nome} vazio={l.key === "fila"} />
                        <span className="truncate text-secondary-foreground">{l.nome}</span>
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="bar-grow block h-full rounded-full"
                          style={
                            {
                              width: `${(l.total / max) * 100}%`,
                              background:
                                l.key === "fila"
                                  ? "var(--destructive)"
                                  : l.eu
                                    ? "var(--primary)"
                                    : "var(--input)",
                              "--d": `${250 + k * 70}ms`,
                            } as CSSProperties
                          }
                        />
                      </span>
                      <span className="text-right font-mono text-xs text-muted-foreground">
                        {l.total}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </section>

            <section className="panel overflow-hidden">
              <header className="panel-header justify-between">
                <span>Por categoria</span>
                <span className="text-xs font-normal text-muted-foreground">
                  abertos em {periodo} dias
                </span>
              </header>
              <div className="p-[1.125rem]">
                <Donut itens={categorias} />
              </div>
            </section>
          </div>
        </div>

        <section style={{ "--i": 3 } as CSSProperties} className="panel overflow-hidden">
          <header className="panel-header flex-wrap justify-between">
            <span>Abertos e solucionados</span>
            <span className="flex gap-4 text-xs font-normal text-secondary-foreground">
              <span className="flex items-center gap-1.5">
                <i className="h-[3px] w-2.5 rounded-full bg-primary" /> Abertos
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-[3px] w-2.5 rounded-full bg-success" /> Solucionados
              </span>
            </span>
          </header>
          <div className="p-[1.125rem]">
            <LineChart serie={serie} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

/* ------------------------------------------------------------------------ */

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="radiogroup"
      className="relative inline-grid rounded-[0.5625rem] bg-muted p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-[3px] top-[3px] rounded-[0.4375rem] bg-surface shadow-[0_1px_3px_#1018281f] transition-transform duration-[350ms] ease-out-soft"
        style={{
          left: 3,
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-[1] h-7 px-3 text-[0.8125rem] font-medium transition-colors ${
            o.value === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  hue,
  label,
  value,
  suffix,
  placeholder,
  bad,
  visual,
  foot,
  to,
  search,
}: {
  icon: React.ComponentType<{ className?: string }>;
  hue: string;
  label: string;
  value: number;
  suffix?: string | undefined;
  placeholder?: string | undefined;
  bad?: boolean;
  visual: ReactNode;
  foot: ReactNode;
  to?: string;
  search?: Record<string, string>;
}) {
  const shown = useCountUp(value);
  const body = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${hue}, transparent)`,
          opacity: 0.6,
        }}
      />
      <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-secondary-foreground">
        <span
          className="flex size-[1.625rem] items-center justify-center rounded-[0.4375rem]"
          style={{ background: `color-mix(in oklab, ${hue} 12%, transparent)`, color: hue }}
        >
          <Icon className="size-[0.9375rem]" />
        </span>
        {label}
      </span>
      <span className="mt-2.5 flex items-end justify-between gap-3">
        <span
          className={`text-[2.125rem] font-semibold leading-none tracking-[-0.04em] tabular-nums ${
            bad ? "text-destructive" : ""
          }`}
        >
          {placeholder ?? (
            <>
              {shown}
              {suffix}
            </>
          )}
        </span>
        <span className="w-24 shrink-0">{visual}</span>
      </span>
      <span className="mt-2.5 block truncate text-xs text-muted-foreground">{foot}</span>
    </>
  );
  const cls = "panel panel-interactive block px-[1.125rem] pb-3.5 pt-4";
  return to ? (
    <Link to={to} search={search as never} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current;
  const w = 96;
  const h = 34;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * w,
    h - 4 - ((v - min) / (max - min || 1)) * (h - 8),
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]!.toFixed(1)} ${p[1]!.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] ?? [0, h];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="block h-[34px] w-24 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="fade-late" d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path
        className="line-draw"
        pathLength={1}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle className="fade-late" cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

function Meter({ value, color }: { value: number; color: string }) {
  return (
    <span className="mb-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
      <span
        className="bar-grow block h-full rounded-full"
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          background: color,
        }}
      />
    </span>
  );
}

function Iniciais({ nome, vazio }: { nome: string; vazio?: boolean }) {
  const ini = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold ${
        vazio
          ? "border border-dashed border-input text-muted-foreground"
          : "bg-accent text-accent-foreground"
      }`}
    >
      {vazio ? "–" : ini}
    </span>
  );
}

/* ------------------------------------------------------------------------ */

function Atendendo({
  ticket,
  fila,
  podeAtender,
  chamando,
  onChamar,
}: {
  ticket: TicketRow | null;
  fila: TicketRow[];
  podeAtender: boolean;
  chamando: boolean;
  onChamar: () => void;
}) {
  const agora = useAgora(1000);

  if (!ticket) {
    return (
      <section className="panel flex flex-wrap items-center justify-between gap-4 px-[1.375rem] py-5">
        <div>
          <h2 className="text-[1.0625rem] font-semibold">Você não está atendendo nenhum chamado</h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {fila.length
              ? `Chame o próximo para assumir o mais urgente da fila (${fila.length === 1 ? "1 esperando" : `${fila.length} esperando`}).`
              : "A fila está vazia. Quando chegar um chamado sem técnico, ele aparece aqui."}
          </p>
        </div>
        {podeAtender && (
          <Button className="btn-sheen h-9" disabled={!fila.length || chamando} onClick={onChamar}>
            <ArrowRight className="size-4" /> {chamando ? "Chamando…" : "Chamar próximo"}
          </Button>
        )}
      </section>
    );
  }

  const p = prazoDe(ticket, agora);
  const r = 48;
  const c = 2 * Math.PI * r;
  const temRelogio =
    p.restanteMs !== null && (p.estado === "late" || p.estado === "warn" || p.estado === "ok");
  // O feixe na borda acompanha o prazo: gelo com folga, âmbar perto de
  // vencer, vermelho (e mais rápido) depois de estourar; parado se pausado.
  const estadoFeixe = p.estado === "done" ? "none" : p.estado;
  const [cor1, cor2] = ANEL_CORES[p.estado];
  const angulo = p.usado * 2 * Math.PI;

  return (
    <div className="feixe dark text-foreground" data-estado={estadoFeixe}>
      <section
        className="panel palco overflow-hidden"
        style={{ borderRadius: "calc(var(--radius-xl) - 1px)" }}
      >
        <div
          key={ticket.id}
          className="slide-in-right grid gap-5 px-[1.375rem] py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"
        >
          <div className="relative size-[7.5rem] shrink-0">
            <svg
              viewBox="0 0 112 112"
              className="size-full -rotate-90 overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="anel-prazo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={cor1} />
                  <stop offset="1" stopColor={cor2} />
                </linearGradient>
              </defs>
              <circle cx="56" cy="56" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle
                className="ring-animated"
                cx="56"
                cy="56"
                r={r}
                fill="none"
                stroke="url(#anel-prazo)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - p.usado)}
                style={
                  {
                    "--ring-circumference": c,
                    transition: "stroke-dashoffset 1s ease",
                    filter: `drop-shadow(0 0 5px color-mix(in oklab, ${cor1} 55%, transparent))`,
                  } as CSSProperties
                }
              />
              {/* Ponta de luz onde o anel termina. */}
              <circle
                className="fade-late"
                cx={56 + r * Math.cos(angulo)}
                cy={56 + r * Math.sin(angulo)}
                r="4.5"
                fill="var(--surface)"
                stroke={cor2}
                strokeWidth="2.5"
                style={{ filter: `drop-shadow(0 0 6px ${cor1})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
              <b
                className={`font-mono text-[0.8125rem] font-medium tabular-nums ${PRAZO_TEXTO[p.estado]}`}
              >
                {temRelogio
                  ? `${p.estado === "late" ? "+" : ""}${relogio(p.restanteMs!)}`
                  : prazoCurto(p)}
              </b>
              <small className="text-[0.6875rem] text-muted-foreground">
                {p.estado === "late" ? "além do prazo" : temRelogio ? "até o prazo" : "de prazo"}
              </small>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-primary">
              <span className="live-dot" style={{ "--dot": "var(--primary)" } as CSSProperties} />
              Você está atendendo
              <span className="font-mono text-xs">{ticketCode(ticket.id)}</span>
            </span>
            <h2 className="text-[1.125rem] font-semibold leading-snug tracking-tight [text-wrap:balance]">
              {ticket.title}
            </h2>
            <span className="text-[0.8125rem] text-secondary-foreground">
              {[ticket.reporter_name, ticket.reporter_sector, ticket.category]
                .filter(Boolean)
                .join(" · ")}{" "}
              · prioridade {PRIORITY_LABEL[ticket.priority].toLowerCase()}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button asChild className="btn-sheen h-9">
                <Link to="/chamados/$id" params={{ id: ticket.id }}>
                  Abrir chamado
                </Link>
              </Button>
              {podeAtender && (
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={!fila.length || chamando}
                  onClick={onChamar}
                >
                  <ArrowRight className="size-4" /> {chamando ? "Chamando…" : "Chamar próximo"}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border bg-surface-2 px-[1.375rem] py-3 text-xs text-muted-foreground">
          <span>A seguir na fila</span>
          {fila.length === 0 && <span>— vazia</span>}
          {fila.map((t) => {
            const pt = prazoDe(t, agora);
            return (
              <Link
                key={t.id}
                to="/chamados/$id"
                params={{ id: t.id }}
                title={t.title}
                className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-surface pl-2.5 pr-3 text-secondary-foreground transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-input hover:shadow-[var(--shadow-1)]"
              >
                <i className="size-1.5 rounded-full" style={{ background: PRAZO_COR[pt.estado] }} />
                <span className="font-mono">{ticketCode(t.id)}</span>
                <span className={PRAZO_TEXTO[pt.estado]}>{prazoCurto(pt)}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const ANEL_CORES: Record<ReturnType<typeof prazoDe>["estado"], [string, string]> = {
  ok: ["var(--primary)", "var(--ice)"],
  warn: ["var(--warning)", "#ffc46b"],
  late: ["var(--destructive)", "#ff8fa0"],
  paused: ["var(--input)", "var(--input)"],
  none: ["var(--input)", "var(--input)"],
  done: ["var(--success)", "var(--success)"],
};

/* ------------------------------------------------------------------------ */

const DONUT_CORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--input)",
];

function Donut({ itens }: { itens: [string, number][] }) {
  const total = itens.reduce((s, [, n]) => s + n, 0);
  const shown = useCountUp(total);
  const r = 52;
  const c = 2 * Math.PI * r;
  let acumulado = 0;

  if (total === 0) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">Nenhum chamado aberto no período.</p>
    );
  }

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[8.25rem_minmax(0,1fr)]">
      <div className="relative mx-auto size-[8.25rem]">
        <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
          {itens.map(([nome, n], k) => {
            const len = Math.max(0, (n / total) * c - (itens.length > 1 ? 2 : 0));
            const off = acumulado;
            acumulado += (n / total) * c;
            return (
              <circle
                key={nome}
                className="arc-grow"
                cx="66"
                cy="66"
                r={r}
                fill="none"
                stroke={DONUT_CORES[k % DONUT_CORES.length]}
                strokeWidth="14"
                strokeDasharray={`${len} ${c}`}
                strokeDashoffset={-off}
                style={{ "--d": `${200 + k * 90}ms` } as CSSProperties}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="text-[1.375rem] font-semibold tracking-tight tabular-nums">{shown}</b>
          <small className="text-[0.6875rem] text-muted-foreground">chamados</small>
        </div>
      </div>
      <ul className="flex min-w-0 flex-col gap-2 text-[0.8125rem]">
        {itens.map(([nome, n], k) => (
          <li key={nome} className="flex items-center gap-2">
            <i
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: DONUT_CORES[k % DONUT_CORES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-secondary-foreground">{nome}</span>
            <span className="font-mono text-xs text-muted-foreground">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineChart({ serie }: { serie: { dia: number; abertos: number; solucionados: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Desenha na largura real do cartão, para o texto não esticar nem encolher.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(280, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 520 ? 200 : 240;
  const L = 30;
  const B = 26;
  const T = 12;
  const R = 10;
  const maxBruto = Math.max(4, ...serie.map((d) => Math.max(d.abertos, d.solucionados)));
  const passo = maxBruto <= 8 ? 2 : maxBruto <= 20 ? 5 : Math.ceil(maxBruto / 4 / 5) * 5;
  const max = Math.ceil(maxBruto / passo) * passo;
  const ih = H - B - T;
  const iw = W - L - R;
  const n = serie.length;
  const x = (i: number) => L + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => T + ih - (v / max) * ih;
  const curva = (k: "abertos" | "solucionados") =>
    serie
      .map((d, i) => {
        if (i === 0) return `M${x(0)} ${y(d[k])}`;
        const cx = (x(i - 1) + x(i)) / 2;
        return `C${cx} ${y(serie[i - 1]![k])} ${cx} ${y(d[k])} ${x(i)} ${y(d[k])}`;
      })
      .join(" ");
  const ticks = Array.from({ length: max / passo + 1 }, (_, i) => i * passo);
  const cada = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 90))));
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const h = hover !== null ? serie[hover] : null;

  return (
    <div ref={boxRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label="Chamados abertos e solucionados por dia"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="painel-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text
              x={L - 10}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}
        {serie.map((d, i) =>
          (i % cada === 0 && n - 1 - i >= cada * 0.6) || i === n - 1 ? (
            <text
              key={d.dia}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {fmt(d.dia)}
            </text>
          ) : null,
        )}
        <path
          key={`a${n}`}
          className="fade-late"
          d={`${curva("abertos")} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`}
          fill="url(#painel-area)"
        />
        <path
          key={`l${n}`}
          className="line-draw"
          pathLength={1}
          d={curva("abertos")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.2"
        />
        <path
          key={`s${n}`}
          className="line-draw"
          pathLength={1}
          d={curva("solucionados")}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.2"
          style={{ "--d": "550ms" } as CSSProperties}
        />
        {h && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={T}
              y2={T + ih}
              stroke="var(--input)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(h.abertos)}
              r="4.5"
              fill="var(--surface)"
              stroke="var(--primary)"
              strokeWidth="2"
            />
            <circle
              cx={x(hover)}
              cy={y(h.solucionados)}
              r="4.5"
              fill="var(--surface)"
              stroke="var(--success)"
              strokeWidth="2"
            />
          </g>
        )}
        {serie.map((d, i) => (
          <rect
            key={`h${d.dia}`}
            x={x(i) - iw / Math.max(1, n - 1) / 2}
            y={T}
            width={iw / Math.max(1, n - 1)}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-[var(--shadow-2)]"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `calc(${(y(Math.max(h.abertos, h.solucionados)) / H) * 100}% - 10px)`,
          }}
        >
          <b>{fmt(h.dia)}</b> · {h.abertos} abertos · {h.solucionados} solucionados
        </div>
      )}
    </div>
  );
}
