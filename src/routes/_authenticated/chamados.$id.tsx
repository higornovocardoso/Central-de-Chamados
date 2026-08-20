import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/routes/_authenticated/painel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/useSession";
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

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do chamado — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Acompanhe o histórico, o responsável e o status de um chamado de suporte de T.I.",
      },
      { property: "og:title", content: "Detalhes do chamado — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Histórico, responsável e status do chamado de suporte técnico.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetalheChamado,
});

function DetalheChamado() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { user } = useSessionUser();
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<TicketStatus>("aberto");
  const [assignee, setAssignee] = useState<string>("none");

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
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data;
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
    if (ticket) {
      setStatus(ticket.status as TicketStatus);
      setAssignee(ticket.assignee_id ?? "none");
    }
  }, [ticket]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profilesQuery.data ?? []) map.set(p.id, p.full_name || p.email);
    return map;
  }, [profilesQuery.data]);

  const isStaff = (staffQuery.data ?? []).some(
    (r) => r.user_id === user?.id && (r.role === "admin" || r.role === "tecnico"),
  );

  const technicians = (staffQuery.data ?? [])
    .filter((r) => r.role === "admin" || r.role === "tecnico")
    .map((r) => r.user_id);

  const updateTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tickets")
        .update({ status, assignee_id: assignee === "none" ? null : assignee })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado");
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error("Falha ao atualizar", { description: e.message }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("ticket_comments")
        .insert({ ticket_id: id, author_id: user.id, body: comment.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (e: Error) => toast.error("Falha ao comentar", { description: e.message }),
  });

  if (ticketQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando chamado...</p>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell>
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
          <Link to="/painel" className="mt-3 inline-block text-sm text-accent hover:underline">
            Voltar ao painel
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/painel"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar ao painel
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {ticketCode(ticket.id)}
              </span>
              <Tag className={STATUS_CLASS[ticket.status as TicketStatus]}>
                {STATUS_LABEL[ticket.status as TicketStatus]}
              </Tag>
              <Tag className={PRIORITY_CLASS[ticket.priority as TicketPriority]}>
                {PRIORITY_LABEL[ticket.priority as TicketPriority]}
              </Tag>
            </div>
            <h1 className="mt-3 text-xl font-semibold">{ticket.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {ticket.description || "Sem descrição."}
            </p>
          </div>

          <div className="panel p-6">
            <h2 className="text-sm font-semibold">Histórico de interações</h2>
            <ul className="mt-4 space-y-4">
              {(commentsQuery.data ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum comentário ainda.</li>
              )}
              {(commentsQuery.data ?? []).map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {nameById.get(c.author_id) ?? "Usuário"}
                    </span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) addComment.mutate();
              }}
            >
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escreva uma atualização ou resposta..."
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={addComment.isPending}>
                  <Send className="size-4" /> Comentar
                </Button>
              </div>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-5 text-sm">
            <Info
              label="Solicitante"
              value={
                ticket.requester_id
                  ? (nameById.get(ticket.requester_id) ?? "—")
                  : ticket.reporter_name || "Formulário público"
              }
            />
            {!ticket.requester_id && (
              <>
                <Info label="E-mail" value={ticket.reporter_email || "—"} />
                <Info label="Setor" value={ticket.reporter_sector || "—"} />
              </>
            )}
            <Info label="Categoria" value={ticket.category} />
            <Info label="Aberto em" value={formatDate(ticket.created_at)} />
            <Info label="Resolvido em" value={formatDate(ticket.resolved_at)} />
            <Info
              label="Responsável"
              value={ticket.assignee_id ? (nameById.get(ticket.assignee_id) ?? "—") : "Não atribuído"}
            />
          </div>

          {isStaff && (
            <div className="panel space-y-4 p-5">
              <h2 className="text-sm font-semibold">Gerenciar atendimento</h2>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Técnico responsável</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não atribuído</SelectItem>
                    {technicians.map((tid) => (
                      <SelectItem key={tid} value={tid}>
                        {nameById.get(tid) ?? tid.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => updateTicket.mutate()}
                disabled={updateTicket.isPending}
              >
                Salvar alterações
              </Button>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}
