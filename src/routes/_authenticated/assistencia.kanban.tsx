import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { LEVEL_CLASS, levelLabel } from "@/lib/itil";
import { STATUS_LABEL, STATUS_ORDER, ticketCode, type TicketStatus } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban" },
      {
        name: "description",
        content: "Chamados, problemas e mudanças em colunas, arrastando entre os status.",
      },
    ],
  }),
  component: Kanban,
});

const PROBLEM_STATUS = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando", label: "Pendente" },
  { value: "solucionado", label: "Solucionado" },
  { value: "fechado", label: "Fechado" },
];

const CHANGE_STATUS = [
  { value: "nova", label: "Nova" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "aceita", label: "Aceita" },
  { value: "em_execucao", label: "Em execução" },
  { value: "aplicada", label: "Aplicada" },
  { value: "fechada", label: "Fechada" },
];

type Board = "ticket" | "problem" | "change";

function Kanban() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<Board>("ticket");
  const [dragging, setDragging] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("*").order("created_at");
      return (data ?? []) as (Record<string, unknown> & { id: string })[];
    },
  });

  const problemsQuery = useQuery({
    queryKey: ["problems"],
    queryFn: async () => {
      const { data } = await looseDb.from("problems").select("*").order("created_at");
      return data ?? [];
    },
  });

  const changesQuery = useQuery({
    queryKey: ["changes"],
    queryFn: async () => {
      const { data } = await looseDb.from("changes").select("*").order("created_at");
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      if (board === "ticket") {
        const { error } = await supabase
          .from("tickets")
          .update({ status: input.status } as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const table = board === "problem" ? "problems" : "changes";
        const { error } = await looseDb
          .from(table)
          .update({ status: input.status })
          .eq("id", input.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
    onError: (e: Error) => toast.error("Não foi possível mover", { description: e.message }),
  });

  const columns =
    board === "ticket"
      ? STATUS_ORDER.map((s) => ({ value: s as string, label: STATUS_LABEL[s] }))
      : board === "problem"
        ? PROBLEM_STATUS
        : CHANGE_STATUS;

  const rows: LooseRow[] =
    board === "ticket"
      ? ((ticketsQuery.data ?? []) as unknown as LooseRow[])
      : board === "problem"
        ? (problemsQuery.data ?? [])
        : (changesQuery.data ?? []);

  const visible = rows.filter((r) => r["is_deleted"] !== true);
  const canMove = can(board, "update");

  return (
    <AppShell
      title="Chamados"
      subtitle="A fila inteira em colunas. Arraste o cartão para mudar o status."
      breadcrumbTail="Kanban"
      actions={
        <div className="flex items-center rounded border border-border">
          <Link
            to="/chamados"
            title="Visão em lista"
            aria-label="Visão em lista"
            className="flex size-7 items-center justify-center rounded-l text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <List className="size-4" />
          </Link>
          <span
            className="flex size-7 items-center justify-center rounded-r bg-secondary text-secondary-foreground"
            title="Visão em Kanban"
            aria-current="page"
          >
            <LayoutGrid className="size-4" />
          </span>
        </div>
      }
    >
      <Tabs value={board} onValueChange={(v) => setBoard(v as Board)}>
        <TabsList className="mb-3 min-h-8">
          <TabsTrigger value="ticket" className="text-xs">
            Chamados
          </TabsTrigger>
          <TabsTrigger value="problem" className="text-xs">
            Problemas
          </TabsTrigger>
          <TabsTrigger value="change" className="text-xs">
            Mudanças
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => {
            const cards = visible.filter((r) => String(r["status"]) === column.value);
            return (
              <section
                key={column.value}
                className="panel flex w-[260px] flex-col"
                onDragOver={(e) => {
                  if (canMove) e.preventDefault();
                }}
                onDrop={() => {
                  if (dragging && canMove) {
                    move.mutate({ id: dragging, status: column.value });
                    setDragging(null);
                  }
                }}
              >
                <header className="panel-header justify-between">
                  <span>{column.label}</span>
                  <span className="rounded bg-secondary px-1.5 text-[0.68rem] tabular-nums text-muted-foreground">
                    {cards.length}
                  </span>
                </header>

                <div className="flex min-h-[120px] flex-col gap-2 p-2">
                  {cards.length === 0 && (
                    <p className="py-4 text-center text-[0.7rem] text-muted-foreground">vazio</p>
                  )}
                  {cards.map((card) => (
                    <article
                      key={card.id}
                      draggable={canMove}
                      onDragStart={() => setDragging(card.id)}
                      onDragEnd={() => setDragging(null)}
                      className={`rounded border border-border bg-background p-2 text-xs ${
                        canMove ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragging === card.id ? "opacity-50" : ""}`}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        {board === "ticket" && (
                          <span className="font-mono text-[0.65rem] text-muted-foreground">
                            {ticketCode(card.id)}
                          </span>
                        )}
                        <Tag className={LEVEL_CLASS[Number(card["priority_level"] ?? 3)] ?? ""}>
                          {levelLabel(Number(card["priority_level"] ?? 3))}
                        </Tag>
                      </div>
                      {board === "ticket" ? (
                        <Link
                          to="/chamados/$id"
                          params={{ id: card.id }}
                          className="line-clamp-3 font-medium text-link hover:underline"
                        >
                          {String(card["title"])}
                        </Link>
                      ) : (
                        <p className="line-clamp-3 font-medium">{String(card["title"])}</p>
                      )}
                      <p className="mt-1 truncate text-[0.68rem] text-muted-foreground">
                        {String(card["category"] ?? "")}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {!canMove && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Seu perfil não pode alterar o status, então os cartões são apenas leitura.
        </p>
      )}
    </AppShell>
  );
}
