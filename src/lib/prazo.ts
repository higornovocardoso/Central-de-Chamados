import { useEffect, useState } from "react";
import { isOpenStatus, type TicketStatus } from "@/lib/tickets";

/**
 * Situação do prazo de solução de um chamado, para as telas que mostram o
 * prazo ao vivo (painel, lista, cartão "Você está atendendo").
 *
 * late    — passou do prazo
 * warn    — vence em menos de 90 minutos
 * ok      — tem folga
 * paused  — pendente: o relógio do SLA fica parado
 * none    — chamado sem SLA
 * done    — solucionado ou fechado
 */
export type PrazoEstado = "late" | "warn" | "ok" | "paused" | "none" | "done";

export type Prazo = {
  estado: PrazoEstado;
  /** Milissegundos até o prazo; negativo quando já passou. */
  restanteMs: number | null;
  /** Fração do prazo já consumida, de 0 a 1. */
  usado: number;
};

const AVISO_MS = 90 * 60 * 1000;

export function prazoDe(
  t: { status: TicketStatus; created_at: string; resolution_due_at: string | null },
  agora: number,
): Prazo {
  if (!isOpenStatus(t.status)) return { estado: "done", restanteMs: null, usado: 1 };
  if (!t.resolution_due_at) return { estado: "none", restanteMs: null, usado: 0 };
  const due = new Date(t.resolution_due_at).getTime();
  const start = new Date(t.created_at).getTime();
  const restanteMs = due - agora;
  const total = Math.max(1, due - start);
  const usado = Math.min(1, Math.max(0, (agora - start) / total));
  if (t.status === "aguardando") return { estado: "paused", restanteMs, usado };
  if (restanteMs < 0) return { estado: "late", restanteMs, usado: 1 };
  return { estado: restanteMs < AVISO_MS ? "warn" : "ok", restanteMs, usado };
}

/** "3 min", "1 h 05 min", "2 d 4 h". */
export function duracao(ms: number) {
  const a = Math.abs(ms);
  const d = Math.floor(a / 86_400_000);
  const h = Math.floor((a % 86_400_000) / 3_600_000);
  const m = Math.floor((a % 3_600_000) / 60_000);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${Math.max(1, m)} min`;
}

/** "01:19:42", para o relógio que corre de segundo em segundo. */
export function relogio(ms: number) {
  const a = Math.floor(Math.abs(ms) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(a / 3600))}:${p(Math.floor((a % 3600) / 60))}:${p(a % 60)}`;
}

/** Texto curto do prazo: "1 h 19 min", "+35 min", "Pausado". */
export function prazoCurto(p: Prazo) {
  switch (p.estado) {
    case "done":
      return "Encerrado";
    case "none":
      return "Sem prazo";
    case "paused":
      return "Pausado";
    case "late":
      return `+${duracao(p.restanteMs ?? 0)}`;
    default:
      return duracao(p.restanteMs ?? 0);
  }
}

/** Texto longo do prazo: "Vence em 1 h 19 min", "Estourou há 35 min". */
export function prazoLongo(p: Prazo) {
  switch (p.estado) {
    case "late":
      return `Estourou há ${duracao(p.restanteMs ?? 0)}`;
    case "warn":
    case "ok":
      return `Vence em ${duracao(p.restanteMs ?? 0)}`;
    default:
      return prazoCurto(p);
  }
}

/** Classe de cor do texto do prazo. */
export const PRAZO_TEXTO: Record<PrazoEstado, string> = {
  late: "text-destructive",
  warn: "text-warning",
  ok: "text-muted-foreground",
  paused: "text-muted-foreground",
  none: "text-muted-foreground",
  done: "text-muted-foreground",
};

/** Cor da barra ou do anel do prazo. */
export const PRAZO_COR: Record<PrazoEstado, string> = {
  late: "var(--destructive)",
  warn: "var(--warning)",
  ok: "var(--primary)",
  paused: "var(--input)",
  none: "var(--input)",
  done: "var(--success)",
};

/** Ordena pelo prazo: quem estoura antes vem primeiro; sem prazo vai ao fim. */
export function porPrazo(
  a: { resolution_due_at: string | null },
  b: { resolution_due_at: string | null },
) {
  const da = a.resolution_due_at ? new Date(a.resolution_due_at).getTime() : Infinity;
  const db = b.resolution_due_at ? new Date(b.resolution_due_at).getTime() : Infinity;
  return da - db;
}

/**
 * O chamado que a pessoa está atendendo agora: o mais urgente dos dela em
 * aberto, fora os pendentes (o relógio deles está parado). É o que ganha o
 * feixe no painel e no quadro.
 */
export function emAtendimento<
  T extends { assignee_id: string | null; status: TicketStatus; resolution_due_at: string | null },
>(tickets: T[], userId: string | null | undefined): T | null {
  if (!userId) return null;
  return (
    tickets
      .filter(
        (t) => t.assignee_id === userId && isOpenStatus(t.status) && t.status !== "aguardando",
      )
      .sort(porPrazo)[0] ?? null
  );
}

/** Hora atual que se renova no intervalo dado, para relógios ao vivo. */
export function useAgora(intervaloMs = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}
