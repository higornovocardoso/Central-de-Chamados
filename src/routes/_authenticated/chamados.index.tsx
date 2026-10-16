import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, SlidingTabs } from "@/components/AppShell";
import { VisaoToggle } from "@/components/VisaoToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useRoles } from "@/hooks/useRoles";
import { useTechnicians } from "@/hooks/useTechnicians";
import { slaState } from "@/lib/glpi";
import { PRAZO_COR, PRAZO_TEXTO, porPrazo, prazoCurto, prazoDe, useAgora } from "@/lib/prazo";
import { levelLabel } from "@/lib/itil";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  isOpenStatus,
  relativeTime,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

type ChamadosSearch = {
  busca?: string | undefined;
  filtro?: string | undefined;
  status?: string | undefined;
  setor?: string | undefined;
  pagina?: number | undefined;
  tamanho?: number | undefined;
  ordem?: string | undefined;
  dir?: "asc" | "desc" | undefined;
};

export const Route = createFileRoute("/_authenticated/chamados/")({
  validateSearch: (search: Record<string, unknown>): ChamadosSearch => {
    const busca = search["busca"];
    const filtro = search["filtro"];
    const status = search["status"];
    const ordem = search["ordem"];
    const dir = search["dir"];
    const pagina = Number(search["pagina"]);
    const tamanho = Number(search["tamanho"]);

    const parsed: ChamadosSearch = {};
    if (typeof busca === "string" && busca) parsed.busca = busca;
    if (typeof filtro === "string" && filtro) parsed.filtro = filtro;
    const setor = search["setor"];
    if (typeof setor === "string" && setor) parsed.setor = setor;
    if (typeof status === "string" && STATUS_ORDER.includes(status as TicketStatus)) {
      parsed.status = status;
    }
    if (pagina > 0) parsed.pagina = pagina;
    if (tamanho > 0) parsed.tamanho = tamanho;
    if (typeof ordem === "string") parsed.ordem = ordem;
    if (dir === "asc" || dir === "desc") parsed.dir = dir;
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Chamados" },
      {
        name: "description",
        content: "Lista completa de chamados com filtros, prioridade, SLA e responsável.",
      },
    ],
  }),
  component: ListaChamados,
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
  reporter_sector: string;
  assignee_id: string | null;
  // Campos da fase 3; ausentes enquanto a migration não roda.
  type?: string;
  priority_level?: number;
  is_deleted?: boolean;
};

/** Critério da barra de pesquisa do GLPI: campo + operador + valor. */
type Criterion = { id: number; field: string; op: string; value: string };

const FIELDS = [
  { key: "title", label: "Título" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Prioridade" },
  { key: "category", label: "Categoria" },
  { key: "requester", label: "Requerente" },
  { key: "assignee", label: "Atribuído a" },
  { key: "reporter_sector", label: "Setor" },
] as const;

const OPERATORS = [
  { key: "contem", label: "contém" },
  { key: "igual", label: "é" },
  { key: "diferente", label: "não é" },
] as const;

const QUICK_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "abertos", label: "Em aberto" },
  { key: "meus", label: "Meus" },
  { key: "nao_atribuidos", label: "Sem técnico" },
  { key: "atrasados", label: "Prazo estourado" },
  { key: "novos", label: "Novos" },
  { key: "incidentes", label: "Incidentes" },
  { key: "requisicoes", label: "Requisições" },
];

/** O filtro rápido de cada aba, separado para também contar quantos cabem nela. */
function passaFiltroRapido(t: TicketRow, quick: string, userId: string | undefined) {
  if (quick === "meus") return t.assignee_id === userId;
  if (quick === "nao_atribuidos") return !t.assignee_id;
  if (quick === "novos") return t.status === "aberto";
  if (quick === "incidentes") return (t.type ?? "incidente") === "incidente";
  if (quick === "requisicoes") return t.type === "requisicao";
  if (quick === "abertos") return isOpenStatus(t.status);
  if (quick === "atrasados") {
    return slaState(t.resolution_due_at, t.resolved_at, t.status === "fechado").late;
  }
  return true;
}

/**
 * O setor vem digitado à mão no formulário público, então o mesmo departamento
 * aparece como "contabil", "Contábil", "Dep Contabil" e "Depto Contábil".
 * Normalizar sem acento, sem caixa e sem os prefixos de "departamento" junta o
 * que é a mesma coisa, para o filtro não virar uma lista de quase-duplicatas.
 * O texto original continua sendo o exibido na coluna.
 */
function normalizaSetor(bruto: string | null | undefined): string {
  const limpo = (bruto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^(depto?|departamento|dep).?s+/, "");
  return limpo;
}

/** Chave do filtro que troca a lista inteira para o que está na lixeira. */
const LIXEIRA = "lixeira";

const COLUMNS = [
  { key: "created_at", label: "Nº", sortable: true, className: "w-[6.5rem]" },
  { key: "title", label: "Chamado", sortable: true, className: "" },
  { key: "status", label: "Status", sortable: true, className: "w-[9.5rem]" },
  { key: "priority", label: "Prioridade", sortable: true, className: "w-[8rem]" },
  { key: "assignee", label: "Técnico", sortable: false, className: "w-[11rem]" },
  { key: "prazo", label: "Prazo", sortable: true, className: "w-[8.5rem]" },
  { key: "updated_at", label: "Atualizado", sortable: true, className: "w-[7rem] text-right" },
] as const;

function ListaChamados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch();
  const { user, isStaff } = useRoles();
  const { can } = usePermissions();
  const techniciansQuery = useTechnicians();

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [showCriteria, setShowCriteria] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");

  const term = searchParams.busca ?? "";
  const quick = searchParams.filtro ?? "todos";
  const naLixeira = quick === LIXEIRA;
  const podeExcluir = can("ticket", "delete");
  const podePurgar = can("ticket", "purge");
  const statusFilter = searchParams.status;
  const setorFilter = searchParams.setor;
  const page = searchParams.pagina ?? 1;
  const pageSize = searchParams.tamanho ?? 15;
  const sortKey = searchParams.ordem ?? "created_at";
  const sortDir = searchParams.dir ?? "desc";

  function setSearch(patch: Partial<ChamadosSearch>) {
    navigate({
      to: "/chamados",
      search: (prev: ChamadosSearch) => ({ ...prev, pagina: undefined, ...patch }),
    });
  }

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      // select("*") para que as colunas da fase 3 apareçam quando existirem,
      // sem quebrar enquanto a migration não foi aplicada.
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

  const technicians = techniciansQuery.data ?? [];

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);

  const requesterOf = useCallback(
    (t: TicketRow) =>
      t.requester_id
        ? (nameById.get(t.requester_id) ?? "—")
        : t.reporter_name || "Formulário público",
    [nameById],
  );
  const assigneeOf = useCallback(
    (t: TicketRow) => (t.assignee_id ? (nameById.get(t.assignee_id) ?? "—") : "Não atribuído"),
    [nameById],
  );

  // O seletor lista só os setores que existem nos chamados: um catálogo fixo
  // ficaria desatualizado, já que o campo é livre.
  const setores = useMemo(() => {
    const porChave = new Map<string, string>();
    for (const t of tickets) {
      const chave = normalizaSetor(t.reporter_sector);
      if (!chave) continue;
      // Guarda o primeiro rótulo visto para cada chave; serve de nome no menu.
      if (!porChave.has(chave)) porChave.set(chave, t.reporter_sector.trim());
    }
    return [...porChave.entries()]
      .map(([chave, rotulo]) => ({ chave, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [tickets]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return tickets.filter((t) => {
      // A lista é uma coisa ou outra: ou a lixeira, ou o resto. Nunca as duas.
      if (Boolean(t.is_deleted) !== naLixeira) return false;

      if (needle) {
        const haystack =
          `${t.title} ${ticketCode(t.id)} ${t.category} ${requesterOf(t)}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      if (statusFilter && t.status !== statusFilter) return false;
      // Comparação por texto normalizado: os setores são digitados à mão no
      // formulário público, e "Contábil" e "contabil" são o mesmo setor.
      if (setorFilter && normalizaSetor(t.reporter_sector) !== setorFilter) return false;

      if (!naLixeira && !passaFiltroRapido(t, quick, user?.id)) return false;

      for (const c of criteria) {
        if (!c.value.trim()) continue;
        const raw =
          c.field === "requester"
            ? requesterOf(t)
            : c.field === "assignee"
              ? assigneeOf(t)
              : c.field === "status"
                ? STATUS_LABEL[t.status]
                : c.field === "priority"
                  ? PRIORITY_LABEL[t.priority]
                  : String(t[c.field as keyof TicketRow] ?? "");
        const value = raw.toLowerCase();
        const wanted = c.value.trim().toLowerCase();
        if (c.op === "contem" && !value.includes(wanted)) return false;
        if (c.op === "igual" && value !== wanted) return false;
        if (c.op === "diferente" && value === wanted) return false;
      }

      return true;
    });
  }, [
    tickets,
    term,
    quick,
    naLixeira,
    statusFilter,
    setorFilter,
    criteria,
    user?.id,
    requesterOf,
    assigneeOf,
  ]);

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    const priorityRank: Record<TicketPriority, number> = {
      critica: 4,
      alta: 3,
      media: 2,
      baixa: 1,
    };
    const statusRank: Record<TicketStatus, number> = {
      aberto: 1,
      em_andamento: 2,
      planejado: 3,
      aguardando: 4,
      resolvido: 5,
      fechado: 6,
    };

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "priority":
          return (priorityRank[a.priority] - priorityRank[b.priority]) * factor;
        case "status":
          return (statusRank[a.status] - statusRank[b.status]) * factor;
        case "title":
          return a.title.localeCompare(b.title, "pt-BR") * factor;
        case "category":
          return a.category.localeCompare(b.category, "pt-BR") * factor;
        case "sector":
          return (a.reporter_sector ?? "").localeCompare(b.reporter_sector ?? "", "pt-BR") * factor;
        case "type":
          return (a.type ?? "").localeCompare(b.type ?? "", "pt-BR") * factor;
        case "id":
          return a.id.localeCompare(b.id) * factor;
        case "prazo":
          return porPrazo(a, b) * factor;
        case "updated_at":
          return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * factor;
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * factor;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  const lixeiraCount = useMemo(() => tickets.filter((t) => t.is_deleted).length, [tickets]);

  const contagemRapida = useMemo(() => {
    const vivos = tickets.filter((t) => !t.is_deleted);
    return Object.fromEntries(
      QUICK_FILTERS.map((f) => [
        f.key,
        vivos.filter((t) => passaFiltroRapido(t, f.key, user?.id)).length,
      ]),
    ) as Record<string, number>;
  }, [tickets, user?.id]);

  // Prazo ao vivo: renova a cada 30 s, o suficiente para a coluna de minutos.
  const agora = useAgora(30_000);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const bulkUpdate = useMutation({
    mutationFn: async () => {
      const patch: {
        status?: TicketStatus;
        priority?: TicketPriority;
        assignee_id?: string | null;
      } = {};
      if (bulkStatus) patch.status = bulkStatus as TicketStatus;
      if (bulkPriority) patch.priority = bulkPriority as TicketPriority;
      if (bulkAssignee) patch.assignee_id = bulkAssignee === "__none__" ? null : bulkAssignee;
      if (Object.keys(patch).length === 0) throw new Error("Escolha o que alterar.");
      // O status "planejado" só existe no enum depois da migration da fase 3.
      const { error } = await supabase
        .from("tickets")
        .update(patch as never)
        .in("id", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selected.length} chamado(s) atualizado(s).`);
      setSelected([]);
      setBulkStatus("");
      setBulkPriority("");
      setBulkAssignee("");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error("Falha na ação em massa", { description: e.message }),
  });

  /**
   * Restaurar é o inverso exato do que a tela do chamado faz ao excluir:
   * desmarca is_deleted e limpa deleted_at. Exige o direito de atualizar.
   */
  const restaurar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("tickets")
        .update({ is_deleted: false, deleted_at: null } as never)
        .in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, ids) => {
      toast.success(`${ids.length} chamado(s) restaurado(s).`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error("Não foi possível restaurar", { description: e.message }),
  });

  /**
   * Purgar apaga a linha de verdade, e não tem volta. O banco só deixa quem
   * tem o direito "purge" — no GLPI é direito separado do de excluir, e aqui
   * também: Supervisor manda para a lixeira, mas não esvazia.
   */
  const purgar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("tickets").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, ids) => {
      toast.success(`${ids.length} chamado(s) apagado(s) em definitivo.`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível apagar", {
        description: e.message.includes("violates foreign key")
          ? "Há registros ligados a este chamado."
          : e.message,
      }),
  });

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSearch({ ordem: key, dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      setSearch({ ordem: key, dir: "asc" });
    }
  }

  return (
    <AppShell
      title={naLixeira ? "Lixeira" : "Chamados"}
      subtitle={
        naLixeira
          ? `${total} na lixeira. Restaurar traz de volta; excluir em definitivo não tem volta.`
          : `${total} ${total === 1 ? "chamado encontrado" : "chamados encontrados"}`
      }
      actions={<VisaoToggle atual="lista" />}
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SlidingTabs
            className="min-w-0 max-w-full flex-1"
            activeKey={naLixeira ? LIXEIRA : statusFilter ? "" : quick}
            onSelect={(key) => {
              setSelected([]);
              setSearch({ filtro: key === "todos" ? undefined : key, status: undefined });
            }}
            items={[
              ...QUICK_FILTERS.map((f) => ({
                key: f.key,
                label: f.label,
                count: contagemRapida[f.key] ?? 0,
              })),
              ...(podeExcluir ? [{ key: LIXEIRA, label: "Lixeira", count: lixeiraCount }] : []),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <span className="sr-only">Buscar chamados</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setSearch({ busca: e.target.value || undefined })}
              placeholder="Buscar por título, número, categoria ou requerente"
              className="h-9 bg-surface pl-9"
            />
          </label>

          {setores.length > 0 && (
            <Select
              value={setorFilter ?? "__todos__"}
              onValueChange={(v) => setSearch({ setor: v === "__todos__" ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-[180px] bg-surface" aria-label="Filtrar por setor">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos os setores</SelectItem>
                {setores.map((s) => (
                  <SelectItem key={s.chave} value={s.chave}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant={showCriteria || criteria.length ? "secondary" : "outline"}
            className="h-9"
            onClick={() => setShowCriteria((v) => !v)}
          >
            <Filter className="size-4" /> Mais filtros
            {criteria.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[0.68rem] text-primary-foreground">
                {criteria.length}
              </span>
            )}
          </Button>

          {statusFilter && (
            <button
              type="button"
              onClick={() => setSearch({ status: undefined })}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70"
            >
              Status: {STATUS_LABEL[statusFilter as TicketStatus]}
              <X className="size-3.5" />
            </button>
          )}
          {setorFilter && (
            <button
              type="button"
              onClick={() => setSearch({ setor: undefined })}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70"
            >
              Setor: {setores.find((s) => s.chave === setorFilter)?.rotulo ?? setorFilter}
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {showCriteria && (
          <div className="panel rise-in space-y-2 p-3">
            {criteria.length === 0 && (
              <p className="text-[0.8125rem] text-muted-foreground">
                Nenhum critério. Adicione um para refinar a busca por qualquer campo.
              </p>
            )}
            {criteria.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <Select
                  value={c.field}
                  onValueChange={(v) =>
                    setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, field: v } : x)))
                  }
                >
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={c.op}
                  onValueChange={(v) =>
                    setCriteria((prev) => prev.map((x) => (x.id === c.id ? { ...x, op: v } : x)))
                  }
                >
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={c.value}
                  onChange={(e) =>
                    setCriteria((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)),
                    )
                  }
                  placeholder="valor"
                  className="h-9 w-[220px]"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  aria-label="Remover critério"
                  onClick={() => setCriteria((prev) => prev.filter((x) => x.id !== c.id))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  { id: Date.now(), field: "title", op: "contem", value: "" },
                ])
              }
            >
              <Plus className="size-4" /> Adicionar critério
            </Button>
          </div>
        )}
      </div>

      {/* Ações da lixeira: restaurar ou apagar de vez */}
      {naLixeira && selected.length > 0 && (
        <div className="panel rise-in mb-3 flex flex-wrap items-center gap-2 border-destructive/30 bg-destructive/5 p-2.5">
          <span className="px-1 text-[0.8125rem] font-medium">
            {selected.length} {selected.length === 1 ? "selecionado" : "selecionados"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => restaurar.mutate(selected)}
            disabled={restaurar.isPending}
          >
            <RotateCcw className="size-3.5" /> Restaurar
          </Button>
          {podePurgar && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={() => {
                const quantos = selected.length;
                if (
                  !window.confirm(`Apagar ${quantos} chamado(s) em definitivo? Isto não tem volta.`)
                ) {
                  return;
                }
                purgar.mutate(selected);
              }}
              disabled={purgar.isPending}
            >
              <Trash2 className="size-3.5" /> Excluir definitivamente
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected([])}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Ações em massa */}
      {isStaff && !naLixeira && selected.length > 0 && (
        <div className="panel rise-in mb-3 flex flex-wrap items-center gap-2 border-primary/25 bg-accent/60 p-2.5">
          <span className="px-1 text-[0.8125rem] font-medium">
            {selected.length} {selected.length === 1 ? "selecionado" : "selecionados"}
          </span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-8 w-[170px] bg-surface">
              <SelectValue placeholder="Alterar status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkPriority} onValueChange={setBulkPriority}>
            <SelectTrigger className="h-8 w-[160px] bg-surface">
              <SelectValue placeholder="Alterar prioridade" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
            <SelectTrigger className="h-8 w-[190px] bg-surface">
              <SelectValue placeholder="Atribuir a" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem técnico</SelectItem>
              {technicians.map((tid) => (
                <SelectItem key={tid} value={tid}>
                  {nameById.get(tid) ?? tid.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8"
            onClick={() => bulkUpdate.mutate()}
            disabled={bulkUpdate.isPending}
          >
            Aplicar
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected([])}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Tabela */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table min-w-[860px] table-fixed">
            <thead>
              <tr>
                <th className="w-11">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) =>
                      setSelected(
                        v
                          ? Array.from(new Set([...selected, ...rows.map((r) => r.id)]))
                          : selected.filter((id) => !rows.some((r) => r.id === id)),
                      )
                    }
                    aria-label="Selecionar todos"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.className}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        {col.label}
                        {sortKey === col.key &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ticketsQuery.isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={COLUMNS.length + 1}>
                      <span className="block h-9 animate-pulse rounded-md bg-muted" />
                    </td>
                  </tr>
                ))}
              {!ticketsQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-6 py-12 text-center">
                    <p className="font-medium">
                      {naLixeira ? "A lixeira está vazia." : "Nenhum chamado encontrado."}
                    </p>
                    {!naLixeira && (
                      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                        Tente outra aba, limpe a busca ou remova os filtros.
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {rows.map((t, k) => {
                const p = prazoDe(t, agora);
                const meu = t.assignee_id === user?.id && isOpenStatus(t.status);
                return (
                  <tr
                    key={t.id}
                    data-selected={selected.includes(t.id)}
                    className="rise-in cursor-pointer"
                    style={{ "--d": `${Math.min(k, 12) * 25}ms` } as React.CSSProperties}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button,[role=checkbox]")) return;
                      navigate({ to: "/chamados/$id", params: { id: t.id } });
                    }}
                  >
                    <td className={meu ? "shadow-[inset_3px_0_0_var(--primary)]" : undefined}>
                      <Checkbox
                        checked={selected.includes(t.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                          )
                        }
                        aria-label={`Selecionar ${t.title}`}
                      />
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{ticketCode(t.id)}</td>
                    <td className="min-w-0">
                      <Link
                        to="/chamados/$id"
                        params={{ id: t.id }}
                        className="block truncate font-medium hover:text-primary"
                      >
                        {t.title}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[requesterOf(t), t.reporter_sector?.trim(), t.category]
                          .filter(Boolean)
                          .join(" · ")}
                        {t.type === "requisicao" ? " · Requisição" : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[t.status]}`}>
                        <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td>
                      <Prioridade nivel={t.priority_level} prioridade={t.priority} />
                    </td>
                    <td>
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar nome={t.assignee_id ? assigneeOf(t) : null} />
                        <span
                          className={`truncate ${t.assignee_id ? "" : "text-muted-foreground"}`}
                        >
                          {t.assignee_id ? assigneeOf(t) : "Sem técnico"}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span
                        className={`block text-[0.8125rem] font-medium tabular-nums ${PRAZO_TEXTO[p.estado]}`}
                      >
                        {prazoCurto(p)}
                      </span>
                      {/* Quanto do prazo já foi consumido, na mesma cor do painel. */}
                      {p.estado !== "done" && p.estado !== "none" && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 block h-1 w-[4.5rem] overflow-hidden rounded-full bg-muted"
                        >
                          <span
                            className="bar-grow block h-full rounded-full"
                            style={
                              {
                                width: `${Math.max(6, p.usado * 100)}%`,
                                background: PRAZO_COR[p.estado],
                                "--d": `${200 + Math.min(k, 12) * 25}ms`,
                              } as React.CSSProperties
                            }
                          />
                        </span>
                      )}
                    </td>
                    <td className="text-right text-xs text-muted-foreground">
                      {relativeTime(t.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {total === 0
              ? "Nenhum item"
              : `Exibindo ${start + 1}–${Math.min(start + pageSize, total)} de ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setSearch({ tamanho: Number(v) })}
            >
              <SelectTrigger className="h-8 w-[120px] bg-surface text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              disabled={currentPage <= 1}
              onClick={() => setSearch({ pagina: currentPage - 1 })}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="size-8"
              disabled={currentPage >= totalPages}
              onClick={() => setSearch({ pagina: currentPage + 1 })}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const STATUS_PILL: Record<TicketStatus, string> = {
  aberto: "pill-info",
  em_andamento: "pill-primary",
  planejado: "pill-purple",
  aguardando: "pill-warning",
  resolvido: "pill-success",
  fechado: "pill-muted",
};

/** Barrinhas de sinal: quanto mais cheias, mais urgente. */
function Prioridade({
  nivel,
  prioridade,
}: {
  nivel?: number | undefined;
  prioridade: TicketPriority;
}) {
  const n = nivel ?? { baixa: 2, media: 3, alta: 4, critica: 5 }[prioridade];
  const cor =
    n >= 5
      ? "var(--destructive)"
      : n === 4
        ? "var(--warning)"
        : n === 3
          ? "var(--primary)"
          : "var(--muted-foreground)";
  const cheias = Math.min(n, 4);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[0.8125rem] text-secondary-foreground">
      <svg viewBox="0 0 15 15" className="size-[15px]" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const h = 4 + i * 3;
          return (
            <rect
              key={i}
              x={1 + i * 3.5}
              y={14 - h}
              width="2.4"
              height={h}
              rx="1"
              fill={i < cheias ? cor : "var(--input)"}
            />
          );
        })}
      </svg>
      {nivel ? levelLabel(nivel) : PRIORITY_LABEL[prioridade]}
    </span>
  );
}

function Avatar({ nome }: { nome: string | null }) {
  if (!nome) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-input text-[0.625rem] text-muted-foreground">
        –
      </span>
    );
  }
  const ini = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[0.625rem] font-semibold text-accent-foreground">
      {ini}
    </span>
  );
}
