/**
 * O vocabulário ITIL do GLPI: tipo do chamado, urgência, impacto, prioridade
 * em cinco níveis mais "Maior", estados de tarefa, aprovação e solução, e os
 * quatro tipos de vínculo entre chamados.
 */

export type TicketType = "incidente" | "requisicao";

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  incidente: "Incidente",
  requisicao: "Requisição",
};

export const TICKET_TYPES: TicketType[] = ["incidente", "requisicao"];

/** 1 a 5 para urgência e impacto; a prioridade ainda aceita 6 = Maior. */
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export const LEVEL_LABEL: Record<number, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
  6: "Maior",
};

export const LEVELS: number[] = [1, 2, 3, 4, 5];
export const PRIORITY_LEVELS: number[] = [1, 2, 3, 4, 5, 6];

export const LEVEL_CLASS: Record<number, string> = {
  1: "bg-secondary text-muted-foreground border-border",
  2: "bg-secondary text-muted-foreground border-border",
  3: "bg-info/15 text-info border-info/30",
  4: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  5: "bg-destructive/15 text-destructive border-destructive/40",
  6: "bg-destructive text-destructive-foreground border-destructive",
};

export const LEVEL_DOT: Record<number, string> = {
  1: "bg-muted-foreground/60",
  2: "bg-muted-foreground",
  3: "bg-info",
  4: "bg-warning",
  5: "bg-destructive",
  6: "bg-destructive",
};

export function levelLabel(level: number | null | undefined) {
  return LEVEL_LABEL[level ?? 3] ?? "Média";
}

/**
 * Matriz padrão, usada só para prever a prioridade enquanto o formulário está
 * aberto. Quem decide de verdade é o gatilho no banco.
 */
export function previewPriority(urgency: number, impact: number) {
  if (urgency === 5 && impact >= 4) return 5;
  if (impact === 5 && urgency >= 4) return 5;
  if (urgency === 1 && impact <= 2) return 1;
  if (impact === 1 && urgency <= 2) return 1;
  return Math.max(1, Math.min(5, Math.floor((urgency + impact) / 2)));
}

// ---------------------------------------------------------------------------

export type TaskState = "informacao" | "a_fazer" | "concluida";

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  informacao: "Informação",
  a_fazer: "A fazer",
  concluida: "Concluída",
};

export const TASK_STATES: TaskState[] = ["informacao", "a_fazer", "concluida"];

export const TASK_STATE_CLASS: Record<TaskState, string> = {
  informacao: "bg-secondary text-muted-foreground border-border",
  a_fazer: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  concluida: "bg-success/15 text-success border-success/30",
};

// ---------------------------------------------------------------------------

export type ValidationState = "nao_sujeito" | "aguardando" | "aprovado" | "recusado";

export const VALIDATION_LABEL: Record<ValidationState, string> = {
  nao_sujeito: "Não sujeito a aprovação",
  aguardando: "Aguardando aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const VALIDATION_CLASS: Record<ValidationState, string> = {
  nao_sujeito: "bg-secondary text-muted-foreground border-border",
  aguardando: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  aprovado: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/15 text-destructive border-destructive/40",
};

/** Mínimo de aprovações exigido, como no GLPI. */
export const VALIDATION_PERCENTS = [
  { value: 0, label: "0% — apenas informativo" },
  { value: 50, label: "50% — metade dos aprovadores" },
  { value: 100, label: "100% — todos os aprovadores" },
];

// ---------------------------------------------------------------------------

export type SolutionState = "aguardando" | "aprovada" | "recusada";

export const SOLUTION_LABEL: Record<SolutionState, string> = {
  aguardando: "Aguardando aprovação do requerente",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

// ---------------------------------------------------------------------------

export type TicketLinkType = "ligado" | "duplicado" | "filho" | "pai";

export const LINK_LABEL: Record<TicketLinkType, string> = {
  ligado: "Ligado a",
  duplicado: "Duplicado de",
  filho: "Filho de",
  pai: "Pai de",
};

export const LINK_TYPES: TicketLinkType[] = ["ligado", "duplicado", "filho", "pai"];

export const LINK_HINT: Record<TicketLinkType, string> = {
  ligado: "Apenas informativo",
  duplicado: "Resolver um resolve os outros",
  filho: "O pai só fecha depois dos filhos",
  pai: "Contém chamados dependentes",
};

// ---------------------------------------------------------------------------

export type ActorRole = "requerente" | "observador" | "atribuido";

export const ACTOR_LABEL: Record<ActorRole, string> = {
  requerente: "Requerente",
  observador: "Observador",
  atribuido: "Atribuído a",
};

export const ACTOR_ROLES: ActorRole[] = ["requerente", "observador", "atribuido"];

/** Soma dos três tipos de custo de um chamado. */
export function totalCost(cost: {
  cost_time: number | string;
  cost_fixed: number | string;
  cost_material: number | string;
}) {
  return Number(cost.cost_time) + Number(cost.cost_fixed) + Number(cost.cost_material);
}

export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
