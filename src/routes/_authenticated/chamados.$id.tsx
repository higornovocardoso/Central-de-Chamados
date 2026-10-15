import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  Link2,
  Lock,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  type ItilCategoryRow,
  type TicketActorRow,
  type TicketCostRow,
  type TicketLinkRow,
  type TicketSolutionRow,
  type TicketTaskRow,
  type TicketValidationRow,
  type LooseRow,
} from "@/integrations/supabase/glpi-db";
import { useSessionUser } from "@/hooks/useSession";
import { prazoDe } from "@/lib/prazo";
import { usePermissions } from "@/hooks/usePermissions";
import { useTechnicians } from "@/hooks/useTechnicians";
import { slaState } from "@/lib/glpi";
import {
  ACTOR_LABEL,
  ACTOR_ROLES,
  LEVELS,
  LEVEL_CLASS,
  LEVEL_DOT,
  LINK_HINT,
  LINK_LABEL,
  LINK_TYPES,
  SOLUTION_LABEL,
  TASK_STATES,
  TASK_STATE_CLASS,
  TASK_STATE_LABEL,
  TICKET_TYPES,
  TICKET_TYPE_LABEL,
  VALIDATION_CLASS,
  VALIDATION_LABEL,
  VALIDATION_PERCENTS,
  formatDuration,
  formatMoney,
  levelLabel,
  previewPriority,
  totalCost,
  type ActorRole,
  type TaskState,
  type TicketLinkType,
  type TicketType,
} from "@/lib/itil";
import {
  STATUS_CLASS,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  isOpenStatus,
  ticketCode,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({
    meta: [
      { title: "Chamado" },
      {
        name: "description",
        content: "Processamento do chamado: acompanhamentos, tarefas, solução, SLA e histórico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetalheChamado,
});

const NONE = "__none__";

/** O chamado vem com select("*"), então os campos da fase 3 podem faltar. */
type Ticket = Record<string, unknown> & { id: string };

const str = (t: Ticket, key: string, fallback = "") =>
  typeof t[key] === "string" ? (t[key] as string) : fallback;
const num = (t: Ticket, key: string, fallback: number) =>
  typeof t[key] === "number" ? (t[key] as number) : fallback;

function DetalheChamado() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSessionUser();
  const { can, hasFlag } = usePermissions();
  const techniciansQuery = useTechnicians();

  const canEdit = can("ticket", "update");

  const [form, setForm] = useState({
    type: "incidente" as TicketType,
    status: "aberto" as TicketStatus,
    urgency: 3,
    impact: 3,
    priority_level: 3,
    priority_manual: false,
    category_id: NONE,
    request_source_id: NONE,
    location_id: NONE,
  });

  // ---- consultas ---------------------------------------------------------

  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Ticket | null;
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email");
      if (error) throw error;
      return data;
    },
  });

  const lookupsQuery = useQuery({
    queryKey: ["itil_lookups"],
    queryFn: async () => {
      const [categories, taskCategories, solutionTypes, sources, groups, suppliers, locations] =
        await Promise.all([
          db.from("itil_categories").select("*").order("path"),
          db.from("task_categories").select("*").order("name"),
          db.from("solution_types").select("*").order("name"),
          db.from("request_sources").select("*").order("name"),
          db.from("user_groups").select("id,name").order("name"),
          supabase.from("suppliers").select("id,name").order("name"),
          supabase.from("locations").select("id,name").order("name"),
        ]);
      return {
        categories: (categories.data ?? []) as ItilCategoryRow[],
        taskCategories: taskCategories.data ?? [],
        solutionTypes: solutionTypes.data ?? [],
        sources: sources.data ?? [],
        groups: groups.data ?? [],
        suppliers: suppliers.data ?? [],
        locations: locations.data ?? [],
        available: !categories.error,
      };
    },
  });

  const actorsQuery = useQuery({
    queryKey: ["ticket_actors", id],
    queryFn: async () => {
      const { data } = await db.from("ticket_actors").select("*").eq("ticket_id", id);
      return (data ?? []) as TicketActorRow[];
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as (Record<string, unknown> & {
        id: string;
        body: string;
        author_id: string;
        created_at: string;
      })[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["ticket_tasks", id],
    queryFn: async () => {
      const { data } = await db
        .from("ticket_tasks")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      return (data ?? []) as TicketTaskRow[];
    },
  });

  const solutionsQuery = useQuery({
    queryKey: ["ticket_solutions", id],
    queryFn: async () => {
      const { data } = await db
        .from("ticket_solutions")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: false });
      return (data ?? []) as TicketSolutionRow[];
    },
  });

  const validationsQuery = useQuery({
    queryKey: ["ticket_validations", id],
    queryFn: async () => {
      const { data } = await db
        .from("ticket_validations")
        .select("*")
        .eq("ticket_id", id)
        .order("requested_at");
      return (data ?? []) as TicketValidationRow[];
    },
  });

  const linksQuery = useQuery({
    queryKey: ["ticket_links", id],
    queryFn: async () => {
      const { data } = await db.from("ticket_links").select("*").eq("ticket_id", id);
      return (data ?? []) as TicketLinkRow[];
    },
  });

  const costsQuery = useQuery({
    queryKey: ["ticket_costs", id],
    queryFn: async () => {
      const { data } = await db.from("ticket_costs").select("*").eq("ticket_id", id);
      return (data ?? []) as TicketCostRow[];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["ticket_documents", id],
    queryFn: async () => {
      const { data: links } = await db
        .from("document_tickets")
        .select("document_id")
        .eq("ticket_id", id);
      const ids = (links ?? []).map((l) => l.document_id);
      if (ids.length === 0) return [];
      const { data } = await db.from("documents").select("*").in("id", ids);
      return data ?? [];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["ticket_history", id],
    queryFn: async () => {
      const { data } = await db
        .from("item_history")
        .select("*")
        .eq("item_type", "ticket")
        .eq("item_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const allTicketsQuery = useQuery({
    queryKey: ["tickets_for_link"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id,title")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const ticket = ticketQuery.data ?? null;
  const lookups = lookupsQuery.data;
  const phase3 = lookups?.available === true;

  useEffect(() => {
    if (!ticket) return;
    setForm({
      type: (str(ticket, "type", "incidente") as TicketType) ?? "incidente",
      status: str(ticket, "status", "aberto") as TicketStatus,
      urgency: num(ticket, "urgency", 3),
      impact: num(ticket, "impact", 3),
      priority_level: num(ticket, "priority_level", 3),
      priority_manual: ticket["priority_manual"] === true,
      category_id: str(ticket, "category_id") || NONE,
      request_source_id: str(ticket, "request_source_id") || NONE,
      location_id: str(ticket, "location_id") || NONE,
    });
  }, [ticket]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of peopleQuery.data ?? []) map.set(p.id, p.full_name || p.email);
    return map;
  }, [peopleQuery.data]);

  const personName = (userId: string | null) =>
    userId ? (nameById.get(userId) ?? userId.slice(0, 8)) : "—";

  const invalidate = (...keys: string[]) => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: [key, id] });
    queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  // ---- mutações ----------------------------------------------------------

  const saveTicket = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = { status: form.status };
      if (phase3) {
        patch["type"] = form.type;
        patch["urgency"] = form.urgency;
        patch["impact"] = form.impact;
        patch["priority_manual"] = form.priority_manual;
        if (form.priority_manual) patch["priority_level"] = form.priority_level;
        patch["category_id"] = form.category_id === NONE ? null : form.category_id;
        patch["request_source_id"] =
          form.request_source_id === NONE ? null : form.request_source_id;
      }
      patch["location_id"] = form.location_id === NONE ? null : form.location_id;

      // O types.ts gerado ainda não conhece as colunas da fase 3.
      const { error } = await supabase
        .from("tickets")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado.");
      invalidate("ticket_history");
    },
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });

  const trashTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tickets")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado movido para a lixeira.");
      navigate({ to: "/chamados" });
    },
    onError: (e: Error) => toast.error("Falha ao excluir", { description: e.message }),
  });

  if (ticketQuery.isLoading) {
    return (
      <AppShell title="Chamado">
        <p className="text-xs text-muted-foreground">Carregando chamado...</p>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell title="Chamado">
        <div className="panel p-10 text-center">
          <p className="text-xs text-muted-foreground">Chamado não encontrado.</p>
          <Link to="/chamados" className="mt-3 inline-block text-xs text-link hover:underline">
            Voltar para a lista
          </Link>
        </div>
      </AppShell>
    );
  }

  const status = str(ticket, "status", "aberto") as TicketStatus;
  const type = str(ticket, "type", "incidente") as TicketType;
  const priorityLevel = num(ticket, "priority_level", 3);
  const validationState = str(ticket, "validation_state", "nao_sujeito") as
    "nao_sujeito" | "aguardando" | "aprovado" | "recusado";
  const resolutionSla = slaState(
    str(ticket, "resolution_due_at") || null,
    str(ticket, "resolved_at") || null,
    status === "fechado",
  );
  const responseSla = slaState(
    str(ticket, "response_due_at") || null,
    str(ticket, "first_response_at") || null,
    false,
  );

  const requesterName = str(ticket, "requester_id")
    ? personName(str(ticket, "requester_id"))
    : str(ticket, "reporter_name") || "Formulário público";

  // Quem está atendendo vê o cabeçalho com o feixe, na cor do prazo — o
  // mesmo sinal do painel e do quadro. Pendente não conta: o relógio parou.
  const atendendoAgora =
    Boolean(user?.id) &&
    str(ticket, "assignee_id") === user?.id &&
    isOpenStatus(status) &&
    status !== "aguardando";
  const prazoAtual = prazoDe(
    {
      status,
      created_at: str(ticket, "created_at"),
      resolution_due_at: str(ticket, "resolution_due_at") || null,
    },
    Date.now(),
  );

  return (
    <AppShell breadcrumbTail={ticketCode(ticket.id)}>
      <Link
        to="/chamados"
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Voltar para a lista
      </Link>

      {/* Cabeçalho */}
      <Vivo ativo={atendendoAgora} estado={prazoAtual.estado}>
        <div
          className={`panel p-4 ${atendendoAgora ? "palco" : "mb-3"}`}
          style={atendendoAgora ? { borderRadius: "calc(var(--radius-xl) - 1px)" } : undefined}
        >
          {atendendoAgora && (
            <span className="mb-2 flex items-center gap-2 text-[0.8125rem] font-medium text-primary">
              <span
                className="live-dot"
                style={{ "--dot": "var(--primary)" } as React.CSSProperties}
              />
              Você está atendendo este chamado
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.72rem] text-muted-foreground">
              {ticketCode(ticket.id)}
            </span>
            <Tag className="border-border bg-secondary text-muted-foreground">
              {TICKET_TYPE_LABEL[type] ?? "Incidente"}
            </Tag>
            <Tag className={STATUS_CLASS[status]}>
              <span className={`mr-1.5 size-2 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </Tag>
            <Tag className={LEVEL_CLASS[priorityLevel] ?? ""}>{levelLabel(priorityLevel)}</Tag>
            {validationState !== "nao_sujeito" && (
              <Tag className={VALIDATION_CLASS[validationState]}>
                {VALIDATION_LABEL[validationState]}
              </Tag>
            )}
            <span className={`text-xs ${resolutionSla.className}`}>SLA: {resolutionSla.label}</span>
            {can("ticket", "delete") && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-xs"
                onClick={() => trashTicket.mutate()}
              >
                <Trash2 className="size-3.5" /> Excluir
              </Button>
            )}
          </div>
          <h1 className="mt-2.5 text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] [text-wrap:balance]">
            {str(ticket, "title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Aberto por {requesterName} em {formatDate(str(ticket, "created_at") || null)}
          </p>
        </div>
      </Vivo>

      {!phase3 && (
        <div className="panel mb-3 border-warning/40 p-3 text-xs text-muted-foreground">
          As tabelas da fase 3 ainda não existem no banco. As abas abaixo aparecem vazias e o
          formulário salva apenas os campos antigos. Aplique a migration da fase 3 para liberar
          tipo, urgência, impacto, tarefas, aprovações e o resto.
        </div>
      )}

      {/* Estrutura da tela de chamado do GLPI: a conversa é o conteúdo
          principal, à esquerda, e os campos ficam no painel de apoio à
          direita. Os dois lados rolam de forma independente. */}
      <div className="itil-object">
        <div className="itil-left-side space-y-3">
          <section className="panel">
            <header className="panel-header">Descrição</header>
            <p className="whitespace-pre-wrap p-3 text-xs leading-relaxed">
              {str(ticket, "description") || "Sem descrição."}
            </p>
          </section>

          {/* A linha do tempo do GLPI: tudo em ordem de acontecimento. */}
          <TicketTimeline
            comments={commentsQuery.data ?? []}
            tasks={tasksQuery.data ?? []}
            solutions={solutionsQuery.data ?? []}
            validations={validationsQuery.data ?? []}
            personName={personName}
            canSeePrivate={hasFlag("followup_see_private")}
            userId={user?.id ?? null}
          />

          {/* A caixa de resposta fica no fim da linha, como no original. */}
          <FollowupsPanel
            composerOnly
            ticketId={id}
            comments={commentsQuery.data ?? []}
            personName={personName}
            sources={lookups?.sources ?? []}
            canSeePrivate={hasFlag("followup_see_private")}
            phase3={phase3}
            userId={user?.id ?? null}
            onChanged={() => invalidate("comments")}
          />
        </div>

        <aside className="itil-right-side space-y-3">
          <section className="panel h-fit">
            <header className="panel-header">Dados do chamado</header>
            <div className="space-y-2.5 p-3">
              <Info label="Aberto em" value={formatDate(str(ticket, "created_at") || null)} />
              <Info
                label="Última atualização"
                value={formatDate(str(ticket, "updated_at") || null)}
              />
              <Info label="Solucionado em" value={formatDate(str(ticket, "resolved_at") || null)} />

              {canEdit ? (
                <div className="space-y-2.5 border-t border-border pt-2.5">
                  {phase3 && (
                    <Picker
                      label="Tipo"
                      value={form.type}
                      onChange={(v) => setForm({ ...form, type: v as TicketType })}
                    >
                      {TICKET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TICKET_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </Picker>
                  )}

                  <Picker
                    label="Status"
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v as TicketStatus })}
                  >
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </Picker>

                  {phase3 && (
                    <>
                      <Picker
                        label="Categoria"
                        value={form.category_id}
                        onChange={(v) => setForm({ ...form, category_id: v })}
                      >
                        <SelectItem value={NONE}>Sem categoria</SelectItem>
                        {(lookups?.categories ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {" ".repeat(c.level * 3)}
                            {c.name}
                          </SelectItem>
                        ))}
                      </Picker>

                      <Picker
                        label="Origem da requisição"
                        value={form.request_source_id}
                        onChange={(v) => setForm({ ...form, request_source_id: v })}
                      >
                        <SelectItem value={NONE}>Não informada</SelectItem>
                        {(lookups?.sources ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </Picker>

                      <div className="grid grid-cols-2 gap-2">
                        <Picker
                          label="Urgência"
                          value={String(form.urgency)}
                          onChange={(v) => setForm({ ...form, urgency: Number(v) })}
                        >
                          {LEVELS.map((l) => (
                            <SelectItem key={l} value={String(l)}>
                              {levelLabel(l)}
                            </SelectItem>
                          ))}
                        </Picker>
                        <Picker
                          label="Impacto"
                          value={String(form.impact)}
                          onChange={(v) => setForm({ ...form, impact: Number(v) })}
                        >
                          {LEVELS.map((l) => (
                            <SelectItem key={l} value={String(l)}>
                              {levelLabel(l)}
                            </SelectItem>
                          ))}
                        </Picker>
                      </div>

                      <div className="space-y-1 rounded border border-border bg-secondary/40 p-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Prioridade</span>
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span
                              className={`size-2 rounded-full ${
                                LEVEL_DOT[
                                  form.priority_manual
                                    ? form.priority_level
                                    : previewPriority(form.urgency, form.impact)
                                ]
                              }`}
                            />
                            {levelLabel(
                              form.priority_manual
                                ? form.priority_level
                                : previewPriority(form.urgency, form.impact),
                            )}
                          </span>
                        </div>
                        <label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                          <Checkbox
                            checked={form.priority_manual}
                            disabled={!hasFlag("ticket_change_priority")}
                            onCheckedChange={(v) =>
                              setForm({ ...form, priority_manual: v === true })
                            }
                          />
                          Definir manualmente
                        </label>
                        {form.priority_manual && (
                          <Select
                            value={String(form.priority_level)}
                            onValueChange={(v) => setForm({ ...form, priority_level: Number(v) })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEVELS.map((l) => (
                                <SelectItem key={l} value={String(l)}>
                                  {levelLabel(l)}
                                </SelectItem>
                              ))}
                              {hasFlag("ticket_major_priority") && (
                                <SelectItem value="6">Maior</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </>
                  )}

                  <Picker
                    label="Local"
                    value={form.location_id}
                    onChange={(v) => setForm({ ...form, location_id: v })}
                  >
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {(lookups?.locations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </Picker>

                  <Button
                    size="sm"
                    className="h-8 w-full"
                    onClick={() => saveTicket.mutate()}
                    disabled={saveTicket.isPending}
                  >
                    Salvar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 border-t border-border pt-2.5">
                  <Info label="Categoria" value={str(ticket, "category", "—")} />
                  <Info label="Prioridade" value={levelLabel(priorityLevel)} />
                </div>
              )}
            </div>
          </section>

          <ActorsPanel
            ticketId={id}
            requesterId={str(ticket, "requester_id") || null}
            reporterName={str(ticket, "reporter_name") || ""}
            reporterEmail={str(ticket, "reporter_email") || ""}
            actors={actorsQuery.data ?? []}
            people={peopleQuery.data ?? []}
            groups={lookups?.groups ?? []}
            suppliers={lookups?.suppliers ?? []}
            technicians={techniciansQuery.data ?? []}
            canEdit={canEdit && phase3}
            personName={personName}
            onChanged={() => invalidate("ticket_actors")}
            onRequesterChanged={() => invalidate("ticket_actors", "ticket")}
          />

          <Accordion type="multiple" className="rounded border border-border bg-card">
            <AccordionItem value="tarefas">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Tarefas ({tasksQuery.data?.length ?? 0})
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <TasksPanel
                  ticketId={id}
                  tasks={tasksQuery.data ?? []}
                  categories={lookups?.taskCategories ?? []}
                  technicians={techniciansQuery.data ?? []}
                  personName={personName}
                  canEdit={can("task", "create") && phase3}
                  userId={user?.id ?? null}
                  onChanged={() => invalidate("ticket_tasks")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="solucao">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Solução
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <SolutionPanel
                  ticketId={id}
                  solutions={solutionsQuery.data ?? []}
                  types={lookups?.solutionTypes ?? []}
                  personName={personName}
                  canSolve={can("solution", "create") && phase3}
                  isRequester={str(ticket, "requester_id") === user?.id}
                  userId={user?.id ?? null}
                  onChanged={() => invalidate("ticket_solutions")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="aprovacoes">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Aprovações ({validationsQuery.data?.length ?? 0})
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <ValidationsPanel
                  ticketId={id}
                  validations={validationsQuery.data ?? []}
                  percent={num(ticket, "validation_percent", 100)}
                  people={peopleQuery.data ?? []}
                  personName={personName}
                  canRequest={hasFlag("validation_request") && phase3}
                  userId={user?.id ?? null}
                  onChanged={() => invalidate("ticket_validations")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ligados">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Chamados ligados ({linksQuery.data?.length ?? 0})
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <LinksPanel
                  ticketId={id}
                  links={linksQuery.data ?? []}
                  tickets={(allTicketsQuery.data ?? []) as { id: string; title: string }[]}
                  canEdit={canEdit && phase3}
                  onChanged={() => invalidate("ticket_links")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="custos">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Custos
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <CostsPanel
                  ticketId={id}
                  costs={costsQuery.data ?? []}
                  canEdit={can("financial_info", "update") && phase3}
                  onChanged={() => invalidate("ticket_costs")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="documentos">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Documentos ({documentsQuery.data?.length ?? 0})
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <DocumentsPanel
                  ticketId={id}
                  entityId={str(ticket, "entity_id")}
                  documents={(documentsQuery.data ?? []) as never[]}
                  canEdit={can("document", "create") && phase3}
                  userId={user?.id ?? null}
                  onChanged={() => invalidate("ticket_documents")}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="estatisticas">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Estatísticas
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <section className="panel">
                    <header className="panel-header">Datas</header>
                    <dl className="divide-y divide-border text-xs">
                      <Stat
                        label="Abertura"
                        value={formatDate(str(ticket, "created_at") || null)}
                      />
                      <Stat
                        label="Primeira resposta"
                        value={formatDate(str(ticket, "first_response_at") || null)}
                      />
                      <Stat
                        label="Última atualização"
                        value={formatDate(str(ticket, "updated_at") || null)}
                      />
                      <Stat
                        label="Solução"
                        value={formatDate(str(ticket, "resolved_at") || null)}
                      />
                      <Stat
                        label="Fechamento"
                        value={formatDate(str(ticket, "closed_at") || null)}
                      />
                    </dl>
                  </section>
                  <section className="panel">
                    <header className="panel-header">Acordo de nível de serviço</header>
                    <dl className="divide-y divide-border text-xs">
                      <Stat
                        label="Prazo de resposta"
                        value={formatDate(str(ticket, "response_due_at") || null)}
                      />
                      <Stat
                        label="Situação da resposta"
                        value={responseSla.label}
                        className={responseSla.className}
                      />
                      <Stat
                        label="Prazo de solução"
                        value={formatDate(str(ticket, "resolution_due_at") || null)}
                      />
                      <Stat
                        label="Situação da solução"
                        value={resolutionSla.label}
                        className={resolutionSla.className}
                      />
                    </dl>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="historico">
              <AccordionTrigger className="px-3 py-2 text-xs font-semibold">
                Histórico
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Histórico</header>
                  <div className="overflow-x-auto">
                    <table className="glpi-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Autor</th>
                          <th>Campo</th>
                          <th>De</th>
                          <th>Para</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="whitespace-nowrap text-muted-foreground">
                            {formatDate(str(ticket, "created_at") || null)}
                          </td>
                          <td>{requesterName}</td>
                          <td colSpan={3}>Chamado criado</td>
                        </tr>
                        {(historyQuery.data ?? []).map((h) => (
                          <tr key={h.id}>
                            <td className="whitespace-nowrap text-muted-foreground">
                              {formatDate(h.created_at)}
                            </td>
                            <td>{personName(h.user_id)}</td>
                            <td className="font-medium">{FIELD_LABEL[h.field] ?? h.field}</td>
                            <td className="max-w-[200px] truncate text-muted-foreground">
                              {h.old_value || "—"}
                            </td>
                            <td className="max-w-[200px] truncate">{h.new_value || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </div>
    </AppShell>
  );
}

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  status: "Status",
  type: "Tipo",
  category: "Categoria",
  urgency: "Urgência",
  impact: "Impacto",
  priority_level: "Prioridade",
  assignee_id: "Atribuído a",
  requester_id: "Requerente",
  entity_id: "Entidade",
  asset_id: "Ativo",
  location_id: "Local",
  validation_state: "Aprovação",
  is_deleted: "Lixeira",
};

/**
 * A linha do tempo do chamado, como no GLPI: acompanhamento, tarefa, solução
 * e aprovação misturados em ordem cronológica, e não separados por aba. Cada
 * entrada mostra de onde veio pela cor do marcador e por uma etiqueta.
 */
type EntradaLinha = {
  id: string;
  tipo: "acompanhamento" | "tarefa" | "solucao" | "aprovacao";
  quando: string;
  autor: string | null;
  texto: string;
  privado: boolean;
  detalhe?: string;
};

const ENTRADA_ROTULO: Record<EntradaLinha["tipo"], string> = {
  acompanhamento: "Acompanhamento",
  tarefa: "Tarefa",
  solucao: "Solução",
  aprovacao: "Aprovação",
};

const ENTRADA_COR: Record<EntradaLinha["tipo"], string> = {
  acompanhamento: "bg-info",
  tarefa: "bg-primary",
  solucao: "bg-success",
  aprovacao: "bg-chart-5",
};

function TicketTimeline({
  comments,
  tasks,
  solutions,
  validations,
  personName,
  canSeePrivate,
  userId,
}: {
  comments: LooseRow[];
  tasks: LooseRow[];
  solutions: LooseRow[];
  validations: LooseRow[];
  personName: (id: string | null) => string;
  canSeePrivate: boolean;
  userId: string | null;
}) {
  const entradas: EntradaLinha[] = [];

  for (const c of comments) {
    entradas.push({
      id: `c-${c.id}`,
      tipo: "acompanhamento",
      quando: String(c["created_at"]),
      autor: (c["author_id"] as string | null) ?? null,
      texto: String(c["body"] ?? ""),
      privado: c["is_private"] === true,
    });
  }
  for (const t of tasks) {
    entradas.push({
      id: `t-${t.id}`,
      tipo: "tarefa",
      quando: String(t["created_at"]),
      autor: (t["author_id"] as string | null) ?? null,
      texto: String(t["content"] ?? ""),
      privado: t["is_private"] === true,
      detalhe: TASK_STATE_LABEL[String(t["state"]) as TaskState] ?? String(t["state"]),
    });
  }
  for (const sol of solutions) {
    entradas.push({
      id: `s-${sol.id}`,
      tipo: "solucao",
      quando: String(sol["created_at"]),
      autor: (sol["author_id"] as string | null) ?? null,
      texto: String(sol["content"] ?? ""),
      privado: false,
      detalhe: String(sol["state"] ?? ""),
    });
  }
  for (const v of validations) {
    entradas.push({
      id: `v-${v.id}`,
      tipo: "aprovacao",
      quando: String(v["requested_at"] ?? v["created_at"]),
      autor: (v["requested_by"] as string | null) ?? null,
      texto: String(v["request_comment"] ?? ""),
      privado: false,
      detalhe: String(v["state"] ?? ""),
    });
  }

  const visiveis = entradas
    .filter((e) => !e.privado || canSeePrivate || e.autor === userId)
    .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime());

  if (visiveis.length === 0) {
    return (
      <section className="panel p-6 text-center text-xs text-muted-foreground">
        Nada registrado ainda. O primeiro acompanhamento aparece aqui.
      </section>
    );
  }

  return (
    <section className="panel p-3">
      <ol className="m-0 list-none p-0">
        {visiveis.map((e) => (
          <li key={e.id} className="timeline-entry">
            <span className={`timeline-dot ${ENTRADA_COR[e.tipo]}`} />
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
              <span className="font-medium text-foreground">{personName(e.autor)}</span>
              <Tag className="border-border bg-secondary text-muted-foreground">
                {ENTRADA_ROTULO[e.tipo]}
              </Tag>
              {e.detalhe && <span>{e.detalhe}</span>}
              {e.privado && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-warning/40 px-1 text-[0.6rem] uppercase text-warning">
                  <Lock className="size-2.5" /> privado
                </span>
              )}
              <span className="ml-auto">{formatDate(e.quando)}</span>
            </div>
            {e.texto && (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{e.texto}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ===========================================================================
// Painéis
// ===========================================================================

function ActorsPanel({
  ticketId,
  requesterId,
  reporterName,
  reporterEmail,
  actors,
  people,
  groups,
  suppliers,
  technicians,
  canEdit,
  personName,
  onChanged,
  onRequesterChanged,
}: {
  ticketId: string;
  actors: TicketActorRow[];
  people: { id: string; full_name: string; email: string }[];
  groups: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  technicians: string[];
  canEdit: boolean;
  personName: (id: string | null) => string;
  onChanged: () => void;
  requesterId: string | null;
  reporterName: string;
  reporterEmail: string;
  onRequesterChanged: () => void;
}) {
  const [role, setRole] = useState<ActorRole>("atribuido");
  const [kind, setKind] = useState<"user" | "group" | "supplier">("user");
  const [value, setValue] = useState("");

  // Troca de requerente. Duas formas, porque a realidade tem as duas: quem
  // tem conta no sistema, e quem só tem nome e e-mail — o caso de quem abre
  // pelo formulário público, que é a maioria num escritório.
  const [trocando, setTrocando] = useState(false);
  const [modoReq, setModoReq] = useState<"conta" | "avulso">(requesterId ? "conta" : "avulso");
  const [reqUser, setReqUser] = useState(requesterId ?? "");
  const [reqNome, setReqNome] = useState(reporterName);
  const [reqEmail, setReqEmail] = useState(reporterEmail);

  const trocarRequerente = useMutation({
    mutationFn: async () => {
      // Um dos dois campos manda; o outro é zerado, para não sobrar
      // requerente fantasma de quando o chamado era do outro tipo.
      const patch =
        modoReq === "conta"
          ? { requester_id: reqUser, reporter_name: "", reporter_email: "" }
          : { requester_id: null, reporter_name: reqNome.trim(), reporter_email: reqEmail.trim() };

      if (modoReq === "conta" && !reqUser) throw new Error("Escolha o usuário.");
      if (modoReq === "avulso" && !reqNome.trim()) throw new Error("Informe o nome.");

      const { error } = await db
        .from("tickets")
        .update(patch as never)
        .eq("id", ticketId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Requerente alterado.");
      setTrocando(false);
      onRequesterChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!value) throw new Error("Escolha quem entra como ator.");
      const payload: Record<string, unknown> = { ticket_id: ticketId, role };
      if (kind === "user") payload["user_id"] = value;
      if (kind === "group") payload["group_id"] = value;
      if (kind === "supplier") payload["supplier_id"] = value;
      const { error } = await db.from("ticket_actors").insert(payload as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setValue("");
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (actorId: string) => {
      const { error } = await db.from("ticket_actors").delete().eq("id", actorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const options =
    kind === "user"
      ? (role === "atribuido" ? people.filter((p) => technicians.includes(p.id)) : people).map(
          (p) => ({ id: p.id, name: p.full_name || p.email }),
        )
      : kind === "group"
        ? groups
        : suppliers;

  return (
    <section className="panel">
      <header className="panel-header">Atores</header>
      <div className="divide-y divide-border">
        {ACTOR_ROLES.map((r) => {
          const list = actors.filter((a) => a.role === r);
          return (
            <div key={r} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                  {ACTOR_LABEL[r]}
                </p>
                {r === "requerente" && canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1 text-[0.68rem]"
                    onClick={() => {
                      setModoReq(requesterId ? "conta" : "avulso");
                      setReqUser(requesterId ?? "");
                      setReqNome(reporterName);
                      setReqEmail(reporterEmail);
                      setTrocando(true);
                    }}
                  >
                    Alterar
                  </Button>
                )}
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        {a.user_id
                          ? personName(a.user_id)
                          : a.group_id
                            ? `Grupo: ${groups.find((g) => g.id === a.group_id)?.name ?? "—"}`
                            : a.supplier_id
                              ? `Fornecedor: ${suppliers.find((s) => s.id === a.supplier_id)?.name ?? "—"}`
                              : a.alternative_email === reporterEmail && reporterName
                                ? `${reporterName} (${a.alternative_email})`
                                : a.alternative_email}
                      </span>
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-5"
                          aria-label="Remover ator"
                          onClick={() => remove.mutate(a.id)}
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={trocando} onOpenChange={setTrocando}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar requerente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Quem é o requerente</Label>
              <Select value={modoReq} onValueChange={(v) => setModoReq(v as "conta" | "avulso")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conta">Um usuário do sistema</SelectItem>
                  <SelectItem value="avulso">Alguém sem conta (nome e e-mail)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modoReq === "conta" ? (
              <div className="space-y-1">
                <Label className="text-[0.7rem] text-muted-foreground">Usuário</Label>
                <Select value={reqUser} onValueChange={setReqUser}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.full_name || pessoa.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {people.length <= 1 && (
                  <p className="text-[0.68rem] text-muted-foreground">
                    Só há um usuário cadastrado. Para escolher colegas aqui, crie as contas em
                    Administração &rsaquo; Usuários — ou use a outra opção, que não exige conta.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-[0.7rem] text-muted-foreground">Nome</Label>
                  <Input
                    value={reqNome}
                    onChange={(e) => setReqNome(e.target.value)}
                    placeholder="Ludmilla Diniz"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.7rem] text-muted-foreground">E-mail</Label>
                  <Input
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="nome@compliancecontabil.com"
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setTrocando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => trocarRequerente.mutate()}
              disabled={trocarRequerente.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canEdit && (
        <div className="space-y-2 border-t border-border p-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={role} onValueChange={(v) => setRole(v as ActorRole)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTOR_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ACTOR_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as "user" | "group" | "supplier");
                setValue("");
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="group">Grupo</SelectItem>
                <SelectItem value="supplier">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7" onClick={() => add.mutate()} disabled={!value}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function FollowupsPanel({
  composerOnly = false,
  ticketId,
  comments,
  personName,
  sources,
  canSeePrivate,
  phase3,
  userId,
  onChanged,
}: {
  ticketId: string;
  comments: (Record<string, unknown> & {
    id: string;
    body: string;
    author_id: string;
    created_at: string;
  })[];
  personName: (id: string | null) => string;
  sources: { id: string; name: string }[];
  canSeePrivate: boolean;
  phase3: boolean;
  userId: string | null;
  onChanged: () => void;
  composerOnly?: boolean;
}) {
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [sourceId, setSourceId] = useState(NONE);

  const add = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada.");
      const payload: Record<string, unknown> = {
        ticket_id: ticketId,
        author_id: userId,
        body: body.trim(),
      };
      if (phase3) {
        payload["is_private"] = isPrivate;
        payload["source_id"] = sourceId === NONE ? null : sourceId;
      }
      const { error } = await supabase.from("ticket_comments").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setIsPrivate(false);
      onChanged();
    },
    onError: (e: Error) =>
      toast.error("Falha ao registrar acompanhamento", { description: e.message }),
  });

  return (
    <section className={composerOnly ? "panel overflow-hidden" : "panel overflow-hidden"}>
      {!composerOnly && <header className="panel-header">Acompanhamentos</header>}
      {!composerOnly && (
        <ul className="divide-y divide-border">
          {comments.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhum acompanhamento registrado.
            </li>
          )}
          {comments.map((c) => {
            const priv = c["is_private"] === true;
            return (
              <li key={c.id} className={`px-3 py-2.5 ${priv ? "bg-warning/5" : ""}`}>
                <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {personName(c.author_id)}
                    {priv && (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-warning/40 px-1 text-[0.6rem] uppercase text-warning">
                        <Lock className="size-2.5" /> privado
                      </span>
                    )}
                  </span>
                  <span>{formatDate(c.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className={`space-y-2 p-3 ${composerOnly ? "" : "border-t border-border"}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um acompanhamento..."
          className="text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          {phase3 && (
            <>
              <label className="flex items-center gap-1.5 text-[0.72rem]">
                <Checkbox
                  checked={isPrivate}
                  disabled={!canSeePrivate}
                  onCheckedChange={(v) => setIsPrivate(v === true)}
                />
                Privado
              </label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem origem</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button type="submit" size="sm" className="ml-auto h-8" disabled={add.isPending}>
            <Send className="size-3.5" /> Adicionar
          </Button>
        </div>
      </form>
    </section>
  );
}

function TasksPanel({
  ticketId,
  tasks,
  categories,
  technicians,
  personName,
  canEdit,
  userId,
  onChanged,
}: {
  ticketId: string;
  tasks: TicketTaskRow[];
  categories: { id: string; name: string }[];
  technicians: string[];
  personName: (id: string | null) => string;
  canEdit: boolean;
  userId: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    content: "",
    category_id: NONE,
    state: "a_fazer" as TaskState,
    assigned_user_id: NONE,
    planned_start: "",
    duration_minutes: 0,
    is_private: false,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.content.trim()) throw new Error("Descreva a tarefa.");
      const { error } = await db.from("ticket_tasks").insert({
        ticket_id: ticketId,
        content: form.content.trim(),
        category_id: form.category_id === NONE ? null : form.category_id,
        state: form.state,
        author_id: userId,
        assigned_user_id: form.assigned_user_id === NONE ? null : form.assigned_user_id,
        planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
        duration_minutes: Number(form.duration_minutes) || 0,
        is_private: form.is_private,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setOpen(false);
      setForm({
        content: "",
        category_id: NONE,
        state: "a_fazer",
        assigned_user_id: NONE,
        planned_start: "",
        duration_minutes: 0,
        is_private: false,
      });
      onChanged();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível criar a tarefa", { description: e.message }),
  });

  const setState = useMutation({
    mutationFn: async (input: { id: string; state: TaskState }) => {
      const { error } = await db
        .from("ticket_tasks")
        .update({ state: input.state })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await db.from("ticket_tasks").delete().eq("id", taskId);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">
        Tarefas
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7"
            onClick={() => setOpen(!open)}
          >
            <Plus className="size-3.5" /> Nova tarefa
          </Button>
        )}
      </header>

      {open && canEdit && (
        <div className="space-y-2 border-b border-border bg-secondary/30 p-3">
          <Textarea
            rows={2}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="O que precisa ser feito..."
            className="text-xs"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Picker
              label="Categoria"
              value={form.category_id}
              onChange={(v) => setForm({ ...form, category_id: v })}
            >
              <SelectItem value={NONE}>Sem categoria</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </Picker>
            <Picker
              label="Estado"
              value={form.state}
              onChange={(v) => setForm({ ...form, state: v as TaskState })}
            >
              {TASK_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATE_LABEL[s]}
                </SelectItem>
              ))}
            </Picker>
            <Picker
              label="Responsável"
              value={form.assigned_user_id}
              onChange={(v) => setForm({ ...form, assigned_user_id: v })}
            >
              <SelectItem value={NONE}>Ninguém</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t} value={t}>
                  {personName(t)}
                </SelectItem>
              ))}
            </Picker>
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Duração (min)</Label>
              <Input
                type="number"
                min={0}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[0.7rem] text-muted-foreground">
                Planejada para (deixa o chamado "Em atendimento (planejado)")
              </Label>
              <Input
                type="datetime-local"
                value={form.planned_start}
                onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <label className="flex items-center gap-1.5 self-end text-xs">
              <Checkbox
                checked={form.is_private}
                onCheckedChange={(v) => setForm({ ...form, is_private: v === true })}
              />
              Privada
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8" onClick={() => add.mutate()} disabled={add.isPending}>
              Criar tarefa
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {tasks.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhuma tarefa registrada.
          </li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Tag className={TASK_STATE_CLASS[t.state]}>{TASK_STATE_LABEL[t.state]}</Tag>
              {t.is_private && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Lock className="size-2.5" /> privada
                </span>
              )}
              <span>{categories.find((c) => c.id === t.category_id)?.name ?? "Sem categoria"}</span>
              {t.assigned_user_id && <span>· {personName(t.assigned_user_id)}</span>}
              {t.duration_minutes > 0 && <span>· {formatDuration(t.duration_minutes)}</span>}
              {t.planned_start && <span>· planejada para {formatDate(t.planned_start)}</span>}
              <span className="ml-auto">{formatDate(t.created_at)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs">{t.content}</p>
            {canEdit && (
              <div className="mt-1.5 flex gap-1">
                {TASK_STATES.filter((s) => s !== t.state).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="h-6 text-[0.68rem]"
                    onClick={() => setState.mutate({ id: t.id, state: s })}
                  >
                    {TASK_STATE_LABEL[s]}
                  </Button>
                ))}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto size-6"
                  aria-label="Remover tarefa"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SolutionPanel({
  ticketId,
  solutions,
  types,
  personName,
  canSolve,
  isRequester,
  userId,
  onChanged,
}: {
  ticketId: string;
  solutions: TicketSolutionRow[];
  types: { id: string; name: string }[];
  personName: (id: string | null) => string;
  canSolve: boolean;
  isRequester: boolean;
  userId: string | null;
  onChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [typeId, setTypeId] = useState(NONE);
  const [answer, setAnswer] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Descreva a solução.");
      const { error } = await db.from("ticket_solutions").insert({
        ticket_id: ticketId,
        content: content.trim(),
        solution_type_id: typeId === NONE ? null : typeId,
        author_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setContent("");
      toast.success("Solução registrada. O chamado foi para Solucionado.");
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível registrar", { description: e.message }),
  });

  const answerSolution = useMutation({
    mutationFn: async (input: { id: string; state: "aprovada" | "recusada" }) => {
      const { error } = await db
        .from("ticket_solutions")
        .update({
          state: input.state,
          answer_comment: answer,
          answered_by: userId,
          answered_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      setAnswer("");
      toast.success(
        variables.state === "aprovada"
          ? "Solução aprovada. O chamado foi fechado."
          : "Solução recusada. O chamado voltou para atendimento.",
      );
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível responder", { description: e.message }),
  });

  const current = solutions[0];

  return (
    <section className="panel">
      <header className="panel-header">Solução</header>

      {solutions.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">
          Nenhuma solução registrada. O chamado segue em atendimento.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {solutions.map((s) => (
            <li key={s.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                <Tag
                  className={
                    s.state === "aprovada"
                      ? "border-success/30 bg-success/15 text-success"
                      : s.state === "recusada"
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-warning/40 bg-warning/20 text-warning"
                  }
                >
                  {SOLUTION_LABEL[s.state]}
                </Tag>
                <span>{types.find((t) => t.id === s.solution_type_id)?.name ?? "Sem tipo"}</span>
                <span>· {personName(s.author_id)}</span>
                <span className="ml-auto">{formatDate(s.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs">{s.content}</p>
              {s.answer_comment && (
                <p className="mt-1 border-l-2 border-border pl-2 text-[0.72rem] text-muted-foreground">
                  Resposta de {personName(s.answered_by)}: {s.answer_comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Aprovação da solução pelo requerente */}
      {current?.state === "aguardando" && isRequester && (
        <div className="space-y-2 border-t border-border bg-secondary/30 p-3">
          <Label className="text-[0.7rem] text-muted-foreground">
            A solução resolveu o seu chamado?
          </Label>
          <Textarea
            rows={2}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Comentário (opcional)"
            className="text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => answerSolution.mutate({ id: current.id, state: "recusada" })}
            >
              <X className="size-3.5" /> Recusar
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={() => answerSolution.mutate({ id: current.id, state: "aprovada" })}
            >
              <Check className="size-3.5" /> Aprovar e fechar
            </Button>
          </div>
        </div>
      )}

      {canSolve && (
        <div className="space-y-2 border-t border-border p-3">
          <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
            <Picker label="Tipo de solução" value={typeId} onChange={setTypeId}>
              <SelectItem value={NONE}>Sem tipo</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </Picker>
          </div>
          <Textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descreva a solução aplicada..."
            className="text-xs"
          />
          <div className="flex justify-end">
            <Button size="sm" className="h-8" onClick={() => add.mutate()} disabled={add.isPending}>
              Registrar solução
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ValidationsPanel({
  ticketId,
  validations,
  percent,
  people,
  personName,
  canRequest,
  userId,
  onChanged,
}: {
  ticketId: string;
  validations: TicketValidationRow[];
  percent: number;
  people: { id: string; full_name: string; email: string }[];
  personName: (id: string | null) => string;
  canRequest: boolean;
  userId: string | null;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [approver, setApprover] = useState("");
  const [comment, setComment] = useState("");
  const [answer, setAnswer] = useState("");

  const request = useMutation({
    mutationFn: async () => {
      if (!approver) throw new Error("Escolha o aprovador.");
      const { error } = await db.from("ticket_validations").insert({
        ticket_id: ticketId,
        requested_by: userId,
        approver_user_id: approver,
        request_comment: comment,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setApprover("");
      setComment("");
      onChanged();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível pedir aprovação", { description: e.message }),
  });

  const answerValidation = useMutation({
    mutationFn: async (input: { id: string; state: "aprovado" | "recusado" }) => {
      const { error } = await db
        .from("ticket_validations")
        .update({
          state: input.state,
          answer_comment: answer,
          answered_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setAnswer("");
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível responder", { description: e.message }),
  });

  const setPercent = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("tickets")
        .update({ validation_percent: value } as never)
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  return (
    <section className="panel">
      <header className="panel-header">Aprovações</header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Label className="text-[0.7rem] text-muted-foreground">Aprovação mínima exigida</Label>
        <Select
          value={String(percent)}
          onValueChange={(v) => setPercent.mutate(Number(v))}
          disabled={!canRequest}
        >
          <SelectTrigger className="h-7 w-[260px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALIDATION_PERCENTS.map((p) => (
              <SelectItem key={p.value} value={String(p.value)}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="divide-y divide-border">
        {validations.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum pedido de aprovação.
          </li>
        )}
        {validations.map((v) => (
          <li key={v.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Tag className={VALIDATION_CLASS[v.state]}>{VALIDATION_LABEL[v.state]}</Tag>
              <span>Aprovador: {personName(v.approver_user_id)}</span>
              <span>· pedido por {personName(v.requested_by)}</span>
              <span className="ml-auto">{formatDate(v.requested_at)}</span>
            </div>
            {v.request_comment && <p className="mt-1 text-xs">{v.request_comment}</p>}
            {v.answer_comment && (
              <p className="mt-1 border-l-2 border-border pl-2 text-[0.72rem] text-muted-foreground">
                {v.answer_comment}
              </p>
            )}
            {v.state === "aguardando" && v.approver_user_id === userId && (
              <div className="mt-2 space-y-2">
                <Textarea
                  rows={2}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Comentário da sua resposta"
                  className="text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => answerValidation.mutate({ id: v.id, state: "recusado" })}
                  >
                    <X className="size-3.5" /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={() => answerValidation.mutate({ id: v.id, state: "aprovado" })}
                  >
                    <Check className="size-3.5" /> Aprovar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canRequest && (
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex gap-2">
            <Select value={approver} onValueChange={setApprover}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Escolha o aprovador" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={() => request.mutate()} disabled={!approver}>
              <Plus className="size-3.5" /> Pedir aprovação
            </Button>
          </div>
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Por que precisa de aprovação..."
            className="text-xs"
          />
        </div>
      )}
    </section>
  );
}

function LinksPanel({
  ticketId,
  links,
  tickets,
  canEdit,
  onChanged,
}: {
  ticketId: string;
  links: TicketLinkRow[];
  tickets: { id: string; title: string }[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState("");
  const [linkType, setLinkType] = useState<TicketLinkType>("ligado");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("ticket_links").insert({
        ticket_id: ticketId,
        linked_ticket_id: target,
        link_type: linkType,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTarget("");
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível vincular", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await db.from("ticket_links").delete().eq("id", linkId);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">Chamados ligados</header>
      <ul className="divide-y divide-border">
        {links.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum chamado vinculado.
          </li>
        )}
        {links.map((l) => (
          <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <Tag className="border-border bg-secondary text-muted-foreground">
              {LINK_LABEL[l.link_type]}
            </Tag>
            <Link
              to="/chamados/$id"
              params={{ id: l.linked_ticket_id }}
              className="flex-1 truncate text-link hover:underline"
            >
              <Link2 className="mr-1 inline size-3" />
              {tickets.find((t) => t.id === l.linked_ticket_id)?.title ??
                ticketCode(l.linked_ticket_id)}
            </Link>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Remover vínculo"
                onClick={() => remove.mutate(l.id)}
              >
                <X className="size-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="space-y-2 border-t border-border p-2">
          <div className="flex gap-2">
            <Select value={linkType} onValueChange={(v) => setLinkType(v as TicketLinkType)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LINK_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Escolha o chamado" />
              </SelectTrigger>
              <SelectContent>
                {tickets
                  .filter(
                    (t) => t.id !== ticketId && !links.some((l) => l.linked_ticket_id === t.id),
                  )
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {ticketCode(t.id)} — {t.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={() => add.mutate()} disabled={!target}>
              <Plus className="size-3.5" />
            </Button>
          </div>
          <p className="text-[0.68rem] text-muted-foreground">{LINK_HINT[linkType]}</p>
        </div>
      )}
    </section>
  );
}

function CostsPanel({
  ticketId,
  costs,
  canEdit,
  onChanged,
}: {
  ticketId: string;
  costs: TicketCostRow[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    duration_minutes: 0,
    cost_time: 0,
    cost_fixed: 0,
    cost_material: 0,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Dê um nome ao custo.");
      const { error } = await db.from("ticket_costs").insert({
        ticket_id: ticketId,
        name: form.name.trim(),
        duration_minutes: Number(form.duration_minutes) || 0,
        cost_time: Number(form.cost_time) || 0,
        cost_fixed: Number(form.cost_fixed) || 0,
        cost_material: Number(form.cost_material) || 0,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setForm({ name: "", duration_minutes: 0, cost_time: 0, cost_fixed: 0, cost_material: 0 });
      onChanged();
    },
    onError: (e: Error) => toast.error("Não foi possível lançar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (costId: string) => {
      const { error } = await db.from("ticket_costs").delete().eq("id", costId);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const total = costs.reduce((sum, c) => sum + totalCost(c), 0);

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">Custos</header>
      <div className="overflow-x-auto">
        <table className="glpi-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Duração</th>
              <th className="text-right">Tempo</th>
              <th className="text-right">Fixo</th>
              <th className="text-right">Material</th>
              <th className="text-right">Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum custo lançado.
                </td>
              </tr>
            )}
            {costs.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{formatDuration(c.duration_minutes)}</td>
                <td className="text-right tabular-nums">{formatMoney(Number(c.cost_time))}</td>
                <td className="text-right tabular-nums">{formatMoney(Number(c.cost_fixed))}</td>
                <td className="text-right tabular-nums">{formatMoney(Number(c.cost_material))}</td>
                <td className="text-right font-medium tabular-nums">{formatMoney(totalCost(c))}</td>
                <td>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label="Remover custo"
                      onClick={() => remove.mutate(c.id)}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {costs.length > 0 && (
              <tr>
                <td colSpan={5} className="text-right font-semibold">
                  Total do chamado
                </td>
                <td className="text-right font-semibold tabular-nums">{formatMoney(total)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="grid gap-2 border-t border-border p-2 sm:grid-cols-6">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome do custo"
            className="h-8 text-xs sm:col-span-2"
          />
          <Input
            type="number"
            min={0}
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            placeholder="Minutos"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="0.01"
            value={form.cost_time}
            onChange={(e) => setForm({ ...form, cost_time: Number(e.target.value) })}
            placeholder="Tempo R$"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            step="0.01"
            value={form.cost_fixed}
            onChange={(e) => setForm({ ...form, cost_fixed: Number(e.target.value) })}
            placeholder="Fixo R$"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              value={form.cost_material}
              onChange={(e) => setForm({ ...form, cost_material: Number(e.target.value) })}
              placeholder="Material R$"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8" onClick={() => add.mutate()}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentsPanel({
  ticketId,
  entityId,
  documents,
  canEdit,
  userId,
  onChanged,
}: {
  ticketId: string;
  entityId: string;
  documents: {
    id: string;
    name: string;
    filename: string;
    size_bytes: number;
    storage_path: string;
    created_at: string;
  }[];
  canEdit: boolean;
  userId: string | null;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = `${ticketId}/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, file);
      if (storageError) throw new Error(storageError.message);

      const { data: doc, error: docError } = await db
        .from("documents")
        .insert({
          name: file.name,
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: path,
          entity_id: entityId,
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (docError) throw new Error(docError.message);

      const { error: linkError } = await db
        .from("document_tickets")
        .insert({ document_id: doc.id, ticket_id: ticketId });
      if (linkError) throw new Error(linkError.message);

      toast.success("Documento anexado.");
      onChanged();
    } catch (e) {
      toast.error("Falha ao anexar", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("documentos").download(path);
    if (error || !data) {
      toast.error("Falha ao baixar", { description: error?.message });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">Documentos</header>
      <ul className="divide-y divide-border">
        {documents.length === 0 && (
          <li className="flex flex-col items-center gap-1 px-3 py-8 text-center text-xs text-muted-foreground">
            <FileText className="size-5" />
            Nenhum documento anexado.
          </li>
        )}
        {documents.map((d) => (
          <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <Paperclip className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => download(d.storage_path, d.filename)}
              className="flex-1 truncate text-left text-link hover:underline"
            >
              {d.name}
            </button>
            <span className="text-muted-foreground">{Math.round(d.size_bytes / 1024)} KB</span>
            <span className="text-muted-foreground">{formatDate(d.created_at)}</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="border-t border-border p-3">
          <Label className="text-[0.7rem] text-muted-foreground">Anexar arquivo</Label>
          <Input
            type="file"
            className="mt-1 h-8 text-xs"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </section>
  );
}

// ===========================================================================
// Peças pequenas
// ===========================================================================

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[0.7rem] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

/** Envolve o bloco com o feixe quando ativo; sem isso, devolve o bloco como está. */
function Vivo({
  ativo,
  estado,
  children,
}: {
  ativo: boolean;
  estado: string;
  children: React.ReactNode;
}) {
  if (!ativo) return <>{children}</>;
  return (
    <div
      className="feixe dark mb-3 text-foreground"
      data-estado={estado === "done" ? "none" : estado}
    >
      {children}
    </div>
  );
}
