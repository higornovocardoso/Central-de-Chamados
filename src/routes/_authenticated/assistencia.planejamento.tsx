import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/Tag";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { ticketCode } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento — Helpdesk T.I." },
      {
        name: "description",
        content: "A agenda da equipe: tarefas de chamado com data marcada.",
      },
    ],
  }),
  component: Planejamento,
});

const ESTADO_CLASS: Record<string, string> = {
  a_fazer: "border-info/30 bg-info/15 text-info",
  concluida: "border-success/30 bg-success/15 text-success",
  informacao: "border-border bg-secondary text-muted-foreground",
};

const ESTADO_LABEL: Record<string, string> = {
  a_fazer: "A fazer",
  concluida: "Concluída",
  informacao: "Informação",
};

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Segunda-feira da semana em que a data cai. */
function inicioDaSemana(base: Date) {
  const d = new Date(base);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function Planejamento() {
  const { can } = usePermissions();
  const acesso = useAcesso("planning");
  const [semana, setSemana] = useState(() => inicioDaSemana(new Date()));

  const tarefas = useQuery({
    queryKey: ["ticket_tasks_planejadas"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("ticket_tasks")
        .select("*")
        .not("planned_start", "is", null)
        .order("planned_start");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const chamados = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id,title");
      return data ?? [];
    },
  });

  const pessoas = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email");
      return data ?? [];
    },
  });

  const tituloDoChamado = (id: unknown) =>
    (chamados.data ?? []).find((t) => t.id === String(id))?.title ?? "Chamado";

  const nomeDaPessoa = (id: unknown) => {
    const p = (pessoas.data ?? []).find((x) => x.id === String(id));
    return p ? p.full_name || p.email : "Não atribuída";
  };

  const fim = useMemo(() => {
    const d = new Date(semana);
    d.setDate(d.getDate() + 7);
    return d;
  }, [semana]);

  /** Sete colunas, cada uma com as tarefas daquele dia. */
  const colunas = useMemo(() => {
    const linhas = (tarefas.data ?? []) as LooseRow[];
    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(semana);
      dia.setDate(dia.getDate() + i);
      const proximo = new Date(dia);
      proximo.setDate(proximo.getDate() + 1);
      return {
        dia,
        itens: linhas.filter((t) => {
          const q = new Date(String(t["planned_start"]));
          return q >= dia && q < proximo;
        }),
      };
    });
  }, [tarefas.data, semana]);

  const noPeriodo = colunas.reduce((n, c) => n + c.itens.length, 0);

  function mover(dias: number) {
    const d = new Date(semana);
    d.setDate(d.getDate() + dias);
    setSemana(d);
  }

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="Planejamento" estado={acesso} mensagem="Seu perfil não tem acesso ao planejamento." />;
  }

  return (
    <AppShell
      title="Planejamento"
      subtitle="As tarefas de chamado com data marcada, semana a semana."
      breadcrumbTail="Planejamento"
      actions={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Semana anterior"
            onClick={() => mover(-7)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setSemana(inicioDaSemana(new Date()))}
          >
            Hoje
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Próxima semana"
            onClick={() => mover(7)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {semana.toLocaleDateString("pt-BR")} a{" "}
        {new Date(fim.getTime() - 86_400_000).toLocaleDateString("pt-BR")} ·{" "}
        {noPeriodo === 0 ? "nenhuma tarefa" : `${noPeriodo} tarefa(s)`}
      </p>

      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        {colunas.map(({ dia, itens }) => {
          const hoje = dia.toDateString() === new Date().toDateString();
          return (
            <section
              key={dia.toISOString()}
              className={`panel overflow-hidden ${hoje ? "border-primary/60" : ""}`}
            >
              <header className="panel-header flex-col items-start gap-0 py-1.5">
                <span className="text-[0.7rem] font-semibold">{DIAS[dia.getDay()]}</span>
                <span className="text-[0.68rem] font-normal text-muted-foreground">
                  {dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {itens.length === 0 && (
                  <li className="px-2 py-4 text-center text-[0.68rem] text-muted-foreground">—</li>
                )}
                {itens.map((t) => (
                  <li key={t.id} className="space-y-1 px-2 py-2">
                    <Link
                      to="/chamados/$id"
                      params={{ id: String(t["ticket_id"]) }}
                      className="block text-[0.72rem] font-medium text-link hover:underline"
                    >
                      {ticketCode(String(t["ticket_id"]))}
                    </Link>
                    <p className="truncate text-[0.7rem]" title={tituloDoChamado(t["ticket_id"])}>
                      {tituloDoChamado(t["ticket_id"])}
                    </p>
                    <p className="text-[0.66rem] text-muted-foreground">
                      {new Date(String(t["planned_start"])).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {nomeDaPessoa(t["assigned_user_id"])}
                    </p>
                    <Tag className={ESTADO_CLASS[String(t["state"])] ?? ""}>
                      {ESTADO_LABEL[String(t["state"])] ?? String(t["state"])}
                    </Tag>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        As tarefas entram aqui quando ganham data de início, na aba Tarefas do chamado. Marcar data
        também leva o chamado para “Em atendimento (planejado)”, como no GLPI.
      </p>
    </AppShell>
  );
}
