import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { VisaoToggle } from "@/components/VisaoToggle";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useSessionUser } from "@/hooks/useSession";
import { levelLabel } from "@/lib/itil";
import { PRAZO_TEXTO, emAtendimento, prazoCurto, prazoDe, useAgora } from "@/lib/prazo";
import {
  PRIORITY_LABEL,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  ticketCode,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/quadro")({
  head: () => ({
    meta: [
      { title: "Quadro de chamados" },
      {
        name: "description",
        content: "Os chamados em colunas por status. Arraste o cartão para mudar o status.",
      },
    ],
  }),
  component: Kanban,
});

type Card = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  priority_level?: number;
  created_at: string;
  resolution_due_at: string | null;
  assignee_id: string | null;
  is_deleted?: boolean;
};

function Kanban() {
  const { can } = usePermissions();
  const { user } = useSessionUser();
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const agora = useAgora(30_000);

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "quadro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Card[];
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
  const nome = (id: string | null) => {
    if (!id) return null;
    const p = (profilesQuery.data ?? []).find((x) => x.id === id);
    return p ? p.full_name || p.email : null;
  };

  const move = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status: input.status } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, input) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["nav_counts"] });
      toast.success(`Chamado movido para ${STATUS_LABEL[input.status as TicketStatus]}.`);
    },
    onError: (e: Error) => toast.error("Não foi possível mover", { description: e.message }),
  });

  const cards = ticketsQuery.data ?? [];
  const canMove = can("ticket", "update");
  // O chamado que você está atendendo ganha o feixe, como no painel.
  const atual = useMemo(
    () => emAtendimento(ticketsQuery.data ?? [], user?.id),
    [ticketsQuery.data, user?.id],
  );

  return (
    <AppShell
      title="Chamados"
      subtitle={
        canMove
          ? "A fila em colunas. Arraste o cartão para mudar o status."
          : "A fila em colunas. Seu perfil não pode alterar o status, então os cartões são só leitura."
      }
      breadcrumbTail="Quadro"
      actions={<VisaoToggle atual="quadro" />}
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-3">
        <div className="flex min-w-max gap-3.5">
          {STATUS_ORDER.map((status) => {
            const coluna = cards.filter((c) => c.status === status);
            return (
              <section
                key={status}
                className={`flex w-[272px] flex-col rounded-[var(--radius-lg)] border bg-surface-2 transition-colors duration-200 ${
                  over === status && dragging ? "border-primary/50 bg-accent/60" : "border-border"
                }`}
                onDragOver={(e) => {
                  if (!canMove) return;
                  e.preventDefault();
                  setOver(status);
                }}
                onDragLeave={() => setOver((o) => (o === status ? null : o))}
                onDrop={() => {
                  if (dragging && canMove) {
                    const card = cards.find((c) => c.id === dragging);
                    if (card && card.status !== status) move.mutate({ id: dragging, status });
                  }
                  setDragging(null);
                  setOver(null);
                }}
              >
                <header className="flex items-center justify-between px-3.5 pb-1.5 pt-3">
                  <span className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                    <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="rounded-full bg-muted px-2 font-mono text-[0.68rem] leading-5 text-muted-foreground">
                    {coluna.length}
                  </span>
                </header>

                <div className="flex min-h-[140px] flex-col gap-2.5 p-2.5">
                  {coluna.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      Nada aqui.
                    </p>
                  )}
                  {coluna.map((card, k) => {
                    const p = prazoDe(card, agora);
                    const tecnico = nome(card.assignee_id);
                    const emFoco = card.id === atual?.id;
                    const atraso = { "--d": `${Math.min(k, 8) * 40}ms` } as CSSProperties;
                    const movimento = `transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)] ${
                      canMove ? "cursor-grab active:cursor-grabbing" : ""
                    } ${dragging === card.id ? "opacity-40" : ""}`;
                    const cartao = (
                      <article
                        key={card.id}
                        draggable={canMove}
                        onDragStart={() => setDragging(card.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        style={emFoco ? undefined : atraso}
                        className={
                          emFoco
                            ? "rounded-[0.625rem] bg-surface p-3"
                            : `rise-in rounded-[0.625rem] border border-border bg-surface p-3 shadow-[var(--shadow-1)] ${movimento}`
                        }
                      >
                        {emFoco && (
                          <span className="sr-only">Você está atendendo este chamado.</span>
                        )}
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            {ticketCode(card.id)}
                          </span>
                          <span className={`font-medium tabular-nums ${PRAZO_TEXTO[p.estado]}`}>
                            {prazoCurto(p)}
                          </span>
                        </div>
                        <Link
                          to="/chamados/$id"
                          params={{ id: card.id }}
                          className="line-clamp-3 font-medium leading-snug hover:text-primary"
                        >
                          {card.title}
                        </Link>
                        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">
                            {card.priority_level
                              ? levelLabel(card.priority_level)
                              : PRIORITY_LABEL[card.priority]}{" "}
                            · {card.category}
                          </span>
                          <span
                            title={tecnico ?? "Sem técnico"}
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold ${
                              tecnico
                                ? "bg-accent text-accent-foreground"
                                : "border border-dashed border-input"
                            }`}
                          >
                            {tecnico
                              ? tecnico
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((s) => s[0]?.toUpperCase())
                                  .join("")
                              : "–"}
                          </span>
                        </div>
                      </article>
                    );
                    if (!emFoco) return cartao;
                    // A entrada vai num invólucro próprio: no mesmo elemento, a
                    // animação de entrada tomaria o lugar do giro do feixe.
                    return (
                      <div key={card.id} className="rise-in" style={atraso}>
                        <div
                          className={`feixe ${movimento}`}
                          data-estado={p.estado}
                          style={{ borderRadius: 11 }}
                        >
                          {cartao}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
