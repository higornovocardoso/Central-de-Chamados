import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/useSession";
import { useRoles } from "@/hooks/useRoles";
import { slaState } from "@/lib/glpi";
import {
  CATEGORIES,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_CLASS,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({
    meta: [
      { title: "Chamado — Helpdesk T.I." },
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

function DetalheChamado() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useSessionUser();
  const { isStaff } = useRoles();

  const [comment, setComment] = useState("");
  const [form, setForm] = useState({
    status: "aberto" as TicketStatus,
    priority: "media" as TicketPriority,
    category: "Outros",
    assignee_id: NONE,
    asset_id: NONE,
    location_id: NONE,
    sector_id: NONE,
  });

  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
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

  const staffQuery = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data;
    },
  });

  const lookups = useQuery({
    queryKey: ["lookups"],
    queryFn: async () => {
      const [locations, sectors, assets] = await Promise.all([
        supabase.from("locations").select("id,name").order("name"),
        supabase.from("sectors").select("id,name").order("name"),
        supabase.from("assets").select("id,name,asset_tag").order("name"),
      ]);
      return {
        locations: locations.data ?? [],
        sectors: sectors.data ?? [],
        assets: assets.data ?? [],
      };
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("id,body,author_id,created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const ticket = ticketQuery.data;

  useEffect(() => {
    if (!ticket) return;
    setForm({
      status: ticket.status as TicketStatus,
      priority: ticket.priority as TicketPriority,
      category: ticket.category,
      assignee_id: ticket.assignee_id ?? NONE,
      asset_id: ticket.asset_id ?? NONE,
      location_id: ticket.location_id ?? NONE,
      sector_id: ticket.sector_id ?? NONE,
    });
  }, [ticket]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilesQuery.data ?? []) map.set(p.id, p.full_name || p.email);
    return map;
  }, [profilesQuery.data]);

  const technicians = (staffQuery.data ?? [])
    .filter((r) => r.role === "admin" || r.role === "tecnico")
    .map((r) => r.user_id);

  const updateTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tickets")
        .update({
          status: form.status,
          priority: form.priority,
          category: form.category,
          assignee_id: form.assignee_id === NONE ? null : form.assignee_id,
          asset_id: form.asset_id === NONE ? null : form.asset_id,
          location_id: form.location_id === NONE ? null : form.location_id,
          sector_id: form.sector_id === NONE ? null : form.sector_id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado.");
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("ticket_comments")
        .insert({ ticket_id: id, author_id: user.id, body: comment.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (e: Error) => toast.error("Falha ao registrar acompanhamento", {
      description: e.message,
    }),
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
          <Link to="/chamados" className="mt-3 inline-block text-xs text-primary hover:underline">
            Voltar para a lista
          </Link>
        </div>
      </AppShell>
    );
  }

  const status = ticket.status as TicketStatus;
  const priority = ticket.priority as TicketPriority;
  const responseSla = slaState(ticket.response_due_at, ticket.first_response_at, false);
  const resolutionSla = slaState(ticket.resolution_due_at, ticket.resolved_at, status === "fechado");
  const comments = commentsQuery.data ?? [];
  const requester = ticket.requester_id
    ? (nameById.get(ticket.requester_id) ?? "—")
    : ticket.reporter_name || "Formulário público";

  const timeline = (
    <ul className="divide-y divide-border">
      {comments.length === 0 && (
        <li className="px-3 py-6 text-center text-xs text-muted-foreground">
          Nenhum acompanhamento registrado.
        </li>
      )}
      {comments.map((c) => (
        <li key={c.id} className="px-3 py-2.5">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span className="font-medium text-foreground">
              {nameById.get(c.author_id) ?? "Usuário"}
            </span>
            <span>{formatDate(c.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs">{c.body}</p>
        </li>
      ))}
    </ul>
  );

  const commentForm = (
    <form
      className="space-y-2 border-t border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (comment.trim()) addComment.mutate();
      }}
    >
      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escreva um acompanhamento..."
        className="text-xs"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" className="h-8" disabled={addComment.isPending}>
          <Send className="size-3.5" /> Adicionar acompanhamento
        </Button>
      </div>
    </form>
  );

  return (
    <AppShell breadcrumbTail={ticketCode(ticket.id)}>
      <Link
        to="/chamados"
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Voltar para a lista
      </Link>

      {/* Cabeçalho do chamado */}
      <div className="panel mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.72rem] text-muted-foreground">
            {ticketCode(ticket.id)}
          </span>
          <Tag className={STATUS_CLASS[status]}>
            <span className={`mr-1.5 size-2 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status]}
          </Tag>
          <Tag className={PRIORITY_CLASS[priority]}>{PRIORITY_LABEL[priority]}</Tag>
          <span className={`text-xs ${resolutionSla.className}`}>SLA: {resolutionSla.label}</span>
        </div>
        <h1 className="mt-2 text-base font-semibold">{ticket.title}</h1>
        <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
          Aberto por {requester} em {formatDate(ticket.created_at)} · Entidade raiz
        </p>
      </div>

      <Tabs defaultValue="chamado">
        <TabsList className="h-8">
          <TabsTrigger value="chamado" className="text-xs">
            Chamado
          </TabsTrigger>
          <TabsTrigger value="acompanhamentos" className="text-xs">
            Acompanhamentos ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="text-xs">
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="solucao" className="text-xs">
            Solução
          </TabsTrigger>
          <TabsTrigger value="estatisticas" className="text-xs">
            Estatísticas
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Aba: Chamado */}
        <TabsContent value="chamado" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <section className="panel h-fit">
              <header className="panel-header">Dados do chamado</header>
              <div className="space-y-2.5 p-3">
                <Field label="Requerente" value={requester} />
                {!ticket.requester_id && (
                  <>
                    <Field label="E-mail" value={ticket.reporter_email || "—"} />
                    <Field label="Setor informado" value={ticket.reporter_sector || "—"} />
                  </>
                )}
                <Field label="Aberto em" value={formatDate(ticket.created_at)} />
                <Field label="Última atualização" value={formatDate(ticket.updated_at)} />
                <Field label="Solucionado em" value={formatDate(ticket.resolved_at)} />

                {isStaff ? (
                  <div className="space-y-2.5 border-t border-border pt-2.5">
                    <Picker label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v as TicketStatus })}>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Prioridade"
                      value={form.priority}
                      onChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
                    >
                      {PRIORITY_ORDER.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Categoria"
                      value={form.category}
                      onChange={(v) => setForm({ ...form, category: v })}
                    >
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Atribuído a"
                      value={form.assignee_id}
                      onChange={(v) => setForm({ ...form, assignee_id: v })}
                    >
                      <SelectItem value={NONE}>Não atribuído</SelectItem>
                      {technicians.map((tid) => (
                        <SelectItem key={tid} value={tid}>
                          {nameById.get(tid) ?? tid.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Ativo relacionado"
                      value={form.asset_id}
                      onChange={(v) => setForm({ ...form, asset_id: v })}
                    >
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {(lookups.data?.assets ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.asset_tag ? ` (${a.asset_tag})` : ""}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Local"
                      value={form.location_id}
                      onChange={(v) => setForm({ ...form, location_id: v })}
                    >
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {(lookups.data?.locations ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Picker
                      label="Setor"
                      value={form.sector_id}
                      onChange={(v) => setForm({ ...form, sector_id: v })}
                    >
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {(lookups.data?.sectors ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </Picker>
                    <Button
                      size="sm"
                      className="h-8 w-full"
                      onClick={() => updateTicket.mutate()}
                      disabled={updateTicket.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5 border-t border-border pt-2.5">
                    <Field label="Categoria" value={ticket.category} />
                    <Field
                      label="Atribuído a"
                      value={
                        ticket.assignee_id
                          ? (nameById.get(ticket.assignee_id) ?? "—")
                          : "Não atribuído"
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-3">
              <section className="panel">
                <header className="panel-header">Descrição</header>
                <p className="whitespace-pre-wrap p-3 text-xs leading-relaxed">
                  {ticket.description || "Sem descrição."}
                </p>
              </section>

              <section className="panel overflow-hidden">
                <header className="panel-header">Acompanhamentos</header>
                {timeline}
                {commentForm}
              </section>
            </div>
          </div>
        </TabsContent>

        {/* Aba: Acompanhamentos */}
        <TabsContent value="acompanhamentos" className="mt-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">Acompanhamentos ({comments.length})</header>
            {timeline}
            {commentForm}
          </section>
        </TabsContent>

        {/* Aba: Tarefas */}
        <TabsContent value="tarefas" className="mt-3">
          <EmptyTab
            title="Nenhuma tarefa registrada"
            description="Tarefas com responsável, duração e planejamento entram junto com o módulo ITIL da próxima etapa."
          />
        </TabsContent>

        {/* Aba: Solução */}
        <TabsContent value="solucao" className="mt-3">
          <section className="panel">
            <header className="panel-header">Solução</header>
            <div className="p-3 text-xs">
              {ticket.resolved_at ? (
                <p>
                  Chamado marcado como <strong>{STATUS_LABEL[status]}</strong> em{" "}
                  {formatDate(ticket.resolved_at)}.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  O chamado ainda não foi solucionado. Altere o status na aba <em>Chamado</em> para
                  registrar a solução.
                </p>
              )}
              <p className="mt-2 text-muted-foreground">
                O campo de texto da solução e o tipo de solução entram na próxima etapa.
              </p>
            </div>
          </section>
        </TabsContent>

        {/* Aba: Estatísticas */}
        <TabsContent value="estatisticas" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <section className="panel">
              <header className="panel-header">Datas</header>
              <dl className="divide-y divide-border text-xs">
                <Stat label="Abertura" value={formatDate(ticket.created_at)} />
                <Stat label="Primeira resposta" value={formatDate(ticket.first_response_at)} />
                <Stat label="Última atualização" value={formatDate(ticket.updated_at)} />
                <Stat label="Solução" value={formatDate(ticket.resolved_at)} />
              </dl>
            </section>
            <section className="panel">
              <header className="panel-header">Acordo de nível de serviço</header>
              <dl className="divide-y divide-border text-xs">
                <Stat label="Prazo de resposta" value={formatDate(ticket.response_due_at)} />
                <Stat
                  label="Situação da resposta"
                  value={responseSla.label}
                  className={responseSla.className}
                />
                <Stat label="Prazo de solução" value={formatDate(ticket.resolution_due_at)} />
                <Stat
                  label="Situação da solução"
                  value={resolutionSla.label}
                  className={resolutionSla.className}
                />
              </dl>
            </section>
          </div>
        </TabsContent>

        {/* Aba: Documentos */}
        <TabsContent value="documentos" className="mt-3">
          <EmptyTab
            icon={<FileText className="size-5" />}
            title="Nenhum documento anexado"
            description="O anexo de arquivos ao chamado entra junto com o módulo de documentos."
          />
        </TabsContent>

        {/* Aba: Histórico */}
        <TabsContent value="historico" className="mt-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">Histórico</header>
            <ul className="divide-y divide-border text-xs">
              <li className="flex items-center justify-between px-3 py-2">
                <span>Chamado criado por {requester}</span>
                <span className="text-muted-foreground">{formatDate(ticket.created_at)}</span>
              </li>
              {comments.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2">
                  <span>Acompanhamento de {nameById.get(c.author_id) ?? "usuário"}</span>
                  <span className="text-muted-foreground">{formatDate(c.created_at)}</span>
                </li>
              ))}
              {ticket.first_response_at && (
                <li className="flex items-center justify-between px-3 py-2">
                  <span>Primeira resposta registrada</span>
                  <span className="text-muted-foreground">
                    {formatDate(ticket.first_response_at)}
                  </span>
                </li>
              )}
              {ticket.resolved_at && (
                <li className="flex items-center justify-between px-3 py-2">
                  <span>Chamado solucionado</span>
                  <span className="text-muted-foreground">{formatDate(ticket.resolved_at)}</span>
                </li>
              )}
            </ul>
            <p className="border-t border-border p-3 text-[0.7rem] text-muted-foreground">
              O registro campo a campo de cada alteração entra na próxima etapa.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
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

function EmptyTab({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-1.5 p-10 text-center">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <p className="text-xs font-medium">{title}</p>
      <p className="max-w-md text-[0.7rem] text-muted-foreground">{description}</p>
    </div>
  );
}
