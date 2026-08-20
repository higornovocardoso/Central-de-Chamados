export type TicketStatus = "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  aberto: "bg-info/15 text-info border-info/30",
  em_andamento: "bg-accent/15 text-accent border-accent/30",
  aguardando: "bg-muted text-muted-foreground border-border",
  resolvido: "bg-success/15 text-success border-success/30",
  fechado: "bg-secondary text-muted-foreground border-border",
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
  alta: "bg-warning/15 text-warning border-warning/30",
  critica: "bg-destructive/15 text-destructive border-destructive/40",
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
  "aguardando",
  "resolvido",
  "fechado",
];

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

export function ticketCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
