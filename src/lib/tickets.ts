export type TicketStatus =
  | "aberto"
  | "em_andamento"
  | "planejado"
  | "aguardando"
  | "resolvido"
  | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

/** Nomes do GLPI. Os valores do banco continuam os mesmos. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Novo",
  em_andamento: "Em atendimento (atribuído)",
  planejado: "Em atendimento (planejado)",
  aguardando: "Pendente",
  resolvido: "Solucionado",
  fechado: "Fechado",
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  aberto: "bg-info/15 text-info border-info/30",
  em_andamento: "bg-primary/15 text-primary border-primary/30",
  planejado: "bg-accent text-accent-foreground border-primary/30",
  aguardando: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  resolvido: "bg-success/15 text-success border-success/30",
  fechado: "bg-secondary text-muted-foreground border-border",
};

/** Bolinha colorida que o GLPI usa antes do nome do status. */
export const STATUS_DOT: Record<TicketStatus, string> = {
  aberto: "bg-info",
  em_andamento: "bg-primary",
  planejado: "bg-chart-5",
  aguardando: "bg-warning",
  resolvido: "bg-success",
  fechado: "bg-muted-foreground",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_CLASS: Record<TicketPriority, string> = {
  baixa: "bg-secondary text-muted-foreground border-border",
  media: "bg-info/15 text-info border-info/30",
  alta: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  critica: "bg-destructive/15 text-destructive border-destructive/40",
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  baixa: "bg-muted-foreground",
  media: "bg-info",
  alta: "bg-warning",
  critica: "bg-destructive",
};

export const CATEGORIES = [
  "Hardware",
  "Software",
  "Rede / Internet",
  "Acesso e senhas",
  "E-mail",
  "Impressora",
  "Sistema interno",
  "Outros",
] as const;

export const STATUS_ORDER: TicketStatus[] = [
  "aberto",
  "em_andamento",
  "planejado",
  "aguardando",
  "resolvido",
  "fechado",
];

export const PRIORITY_ORDER: TicketPriority[] = ["critica", "alta", "media", "baixa"];

/** Status que ainda contam como chamado em aberto. */
export const OPEN_STATUSES: TicketStatus[] = [
  "aberto",
  "em_andamento",
  "planejado",
  "aguardando",
];

export function isOpenStatus(status: TicketStatus) {
  return OPEN_STATUSES.includes(status);
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "há 2 h", "há 3 d" — a coluna "Última atualização" do GLPI. */
export function relativeTime(value: string | null) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  return `há ${months} m`;
}

export function ticketCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
