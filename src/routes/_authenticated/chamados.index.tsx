import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { LEVEL_DOT, TICKET_TYPE_LABEL, levelLabel, type TicketType } from "@/lib/itil";
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
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
  { key: "meus", label: "Meus chamados" },
  { key: "nao_atribuidos", label: "Não atribuídos" },
  { key: "atrasados", label: "Atrasados" },
  { key: "novos", label: "Novos" },
  { key: "abertos", label: "Em aberto" },
  { key: "incidentes", label: "Incidentes" },
  { key: "requisicoes", label: "Requisições" },
];

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
  { key: "id", label: "ID", sortable: true },
  { key: "type", label: "Tipo", sortable: true },
  { key: "title", label: "Título", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "updated_at", label: "Última atualização", sortable: true },
  { key: "created_at", label: "Data de abertura", sortable: true },
  { key: "priority", label: "Prioridade", sortable: true },
  { key: "requester", label: "Requerente", sortable: false },
  { key: "sector", label: "Setor", sortable: true },
  { key: "assignee", label: "Atribuído a", sortable: false },
  { key: "category", label: "Categoria", sortable: true },
  { key: "entity", label: "Entidade", sortable: false },
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

      if (quick === "meus" && t.assignee_id !== user?.id) return false;
      if (quick === "nao_atribuidos" && t.assignee_id) return false;
      if (quick === "novos" && t.status !== "aberto") return false;
      if (quick === "incidentes" && (t.type ?? "incidente") !== "incidente") return false;
      if (quick === "requisicoes" && t.type !== "requisicao") return false;
      if (quick === "abertos" && !isOpenStatus(t.status)) return false;
      if (quick === "atrasados") {
        const sla = slaState(t.resolution_due_at, t.resolved_at, t.status === "fechado");
        if (!sla.late) return false;
      }

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
          ? `${total} chamado(s) na lixeira. Restaurar traz de volta; excluir em definitivo não tem volta.`
          : `${total} chamado(s) encontrado(s)`
      }
      actions={
        <div className="flex items-center gap-1">
          {/* Alternador de visualização do GLPI: o Kanban é um modo de ver a
              lista, não uma tela separada no menu. */}
          <div className="mr-1 flex items-center rounded border border-border">
            <span
              className="flex size-7 items-center justify-center rounded-l bg-secondary text-secondary-foreground"
              title="Visão em lista"
              aria-current="page"
            >
              <List className="size-4" />
            </span>
            <Link
              to="/assistencia/kanban"
              title="Visão em Kanban"
              aria-label="Visão em Kanban"
              className="flex size-7 items-center justify-center rounded-r text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <LayoutGrid className="size-4" />
            </Link>
          </div>
          <Button size="sm" className="h-8" asChild>
            <Link to="/chamados/novo">
              <Plus className="size-4" /> Adicionar
            </Link>
          </Button>
        </div>
      }
    >
      {/* Barra de pesquisa, no formato do GLPI */}
      <div className="panel mb-3">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setSearch({ busca: e.target.value || undefined })}
              placeholder="Buscar por título, número, categoria ou requerente..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant={showCriteria ? "secondary" : "outline"}
            className="h-8"
            onClick={() => setShowCriteria((v) => !v)}
          >
            <Filter className="size-3.5" /> Pesquisa avançada
          </Button>

          {setores.length > 0 && (
            <Select
              value={setorFilter ?? "__todos__"}
              onValueChange={(v) => setSearch({ setor: v === "__todos__" ? undefined : v })}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Filtrar por setor">
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
        </div>

        {showCriteria && (
          <div className="space-y-2 border-t border-border p-2">
            {criteria.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum critério. Adicione um para refinar a busca.
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
                  <SelectTrigger className="h-8 w-[150px] text-xs">
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
                  <SelectTrigger className="h-8 w-[120px] text-xs">
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
                  className="h-8 w-[200px] text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Remover critério"
                  onClick={() => setCriteria((prev) => prev.filter((x) => x.id !== c.id))}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  { id: Date.now(), field: "title", op: "contem", value: "" },
                ])
              }
            >
              <Plus className="size-3.5" /> Adicionar critério
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setSelected([]);
                setSearch({ filtro: f.key === "todos" ? undefined : f.key, status: undefined });
              }}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                quick === f.key && !statusFilter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          {podeExcluir && (
            <button
              type="button"
              onClick={() => {
                setSelected([]);
                setSearch({ filtro: LIXEIRA, status: undefined });
              }}
              className={`ml-1 inline-flex items-center gap-1 rounded border-l border-border pl-2 pr-2 py-1 text-xs transition-colors ${
                naLixeira
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              title="Chamados excluídos, que ainda dá para restaurar"
            >
              <Trash2 className="size-3.5" /> Lixeira
              {lixeiraCount > 0 && (
                <span className="ml-0.5 rounded bg-black/20 px-1 tabular-nums">{lixeiraCount}</span>
              )}
            </button>
          )}
          {setorFilter && (
            <button
              type="button"
              onClick={() => setSearch({ setor: undefined })}
              className="ml-1 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              Setor: {setores.find((s) => s.chave === setorFilter)?.rotulo ?? setorFilter}
              <X className="size-3" />
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              onClick={() => setSearch({ status: undefined })}
              className="ml-1 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              Status: {STATUS_LABEL[statusFilter as TicketStatus]}
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Ações da lixeira: restaurar ou apagar de vez */}
      {naLixeira && selected.length > 0 && (
        <div className="panel mb-2 flex flex-wrap items-center gap-2 border-destructive/30 bg-destructive/10 p-2">
          <span className="text-xs font-medium">{selected.length} selecionado(s)</span>
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
        <div className="panel mb-2 flex flex-wrap items-center gap-2 bg-accent/40 p-2">
          <span className="text-xs font-medium">{selected.length} selecionado(s)</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
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
            <SelectTrigger className="h-8 w-[160px] text-xs">
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
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue placeholder="Atribuir a" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não atribuído</SelectItem>
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
          <table className="glpi-table">
            <thead>
              <tr>
                <th className="w-9">
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
                  <th key={col.key}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
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
              {ticketsQuery.isLoading && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Carregando chamados...
                  </td>
                </tr>
              )}
              {!ticketsQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="p-8 text-center text-muted-foreground"
                  >
                    {naLixeira
                      ? "A lixeira está vazia."
                      : "Nenhum chamado encontrado com esses critérios."}
                  </td>
                </tr>
              )}
              {rows.map((t) => {
                const sla = slaState(t.resolution_due_at, t.resolved_at, t.status === "fechado");
                return (
                  <tr key={t.id} data-selected={selected.includes(t.id)}>
                    <td>
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
                    <td className="font-mono text-[0.72rem] text-muted-foreground">
                      {ticketCode(t.id)}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {TICKET_TYPE_LABEL[(t.type ?? "incidente") as TicketType]}
                    </td>
                    <td className="max-w-[320px]">
                      <Link
                        to="/chamados/$id"
                        params={{ id: t.id }}
                        className="block truncate font-medium text-link hover:underline"
                      >
                        {t.title}
                      </Link>
                      {sla.late && (
                        <span className="text-[0.7rem] text-destructive">SLA {sla.label}</span>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className={`size-2 rounded-full ${STATUS_DOT[t.status]}`} />
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {relativeTime(t.updated_at)}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatDate(t.created_at)}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {t.priority_level ? (
                          <>
                            <span
                              className={`size-2 rounded-full ${LEVEL_DOT[t.priority_level]}`}
                            />
                            {levelLabel(t.priority_level)}
                          </>
                        ) : (
                          <>
                            <span className={`size-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                            {PRIORITY_LABEL[t.priority]}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate">{requesterOf(t)}</td>
                    <td className="max-w-[140px] truncate text-muted-foreground">
                      {t.reporter_sector?.trim() || "—"}
                    </td>
                    <td className="max-w-[160px] truncate">{assigneeOf(t)}</td>
                    <td className="whitespace-nowrap">{t.category}</td>
                    <td className="whitespace-nowrap text-muted-foreground">Entidade raiz</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-1.5 text-xs">
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
              <SelectTrigger className="h-7 w-[110px] text-xs">
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
              className="size-7"
              disabled={currentPage <= 1}
              onClick={() => setSearch({ pagina: currentPage - 1 })}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              disabled={currentPage >= totalPages}
              onClick={() => setSearch({ pagina: currentPage + 1 })}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
