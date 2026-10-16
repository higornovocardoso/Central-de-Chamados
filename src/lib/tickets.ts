export type TicketStatus =
  "aberto" | "em_andamento" | "planejado" | "aguardando" | "resolvido" | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

/** Nomes do GLPI. Os valores do banco continuam os mesmos. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Novo",
  em_andamento: "Em atendimento",
  planejado: "Planejado",
  aguardando: "Pendente",
  resolvido: "Solucionado",
  fechado: "Fechado",
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  aberto: "bg-info/15 text-info",
  em_andamento: "bg-primary/12 text-primary",
  planejado: "bg-plan/12 text-plan",
  aguardando: "bg-warning/20 text-warning",
  resolvido: "bg-success/15 text-success",
  fechado: "bg-secondary text-muted-foreground",
};

/** Bolinha colorida que o GLPI usa antes do nome do status. */
export const STATUS_DOT: Record<TicketStatus, string> = {
  aberto: "bg-info",
  em_andamento: "bg-primary",
  planejado: "bg-plan",
  aguardando: "bg-warning",
  resolvido: "bg-success",
  fechado: "bg-muted-foreground",
};

/** Matiz do cartão big-number do painel, um por status. */
export const STATUS_TILE: Record<TicketStatus, string> = {
  aberto: "tile-info",
  em_andamento: "tile-primary",
  planejado: "tile-purple",
  aguardando: "tile-warning",
  resolvido: "tile-success",
  fechado: "tile-muted",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_CLASS: Record<TicketPriority, string> = {
  baixa: "bg-secondary text-muted-foreground",
  media: "bg-info/15 text-info",
  alta: "bg-warning/20 text-warning",
  critica: "bg-destructive/15 text-destructive",
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
export const OPEN_STATUSES: TicketStatus[] = ["aberto", "em_andamento", "planejado", "aguardando"];

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
