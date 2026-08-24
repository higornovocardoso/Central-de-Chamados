export type AssetKind =
  | "computador"
  | "notebook"
  | "monitor"
  | "impressora"
  | "rede"
  | "telefonia"
  | "licenca"
  | "outro"
  | "periferico"
  | "cartucho"
  | "consumivel"
  | "rack"
  | "gabinete"
  | "pdu"
  | "passivo"
  | "nao_gerenciado"
  | "cabo"
  | "sim_card"
  | "software";

export type AssetStatus = "em_uso" | "estoque" | "manutencao" | "descartado";

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  computador: "Computador",
  notebook: "Notebook",
  monitor: "Monitor",
  software: "Software",
  rede: "Equipamento de rede",
  periferico: "Periférico",
  impressora: "Impressora",
  cartucho: "Cartucho",
  consumivel: "Consumível",
  telefonia: "Telefone",
  rack: "Rack",
  gabinete: "Gabinete",
  pdu: "PDU",
  passivo: "Dispositivo passivo",
  nao_gerenciado: "Ativo não gerenciado",
  cabo: "Cabo",
  sim_card: "Cartão SIM",
  licenca: "Licença",
  outro: "Outro",
};

export const ASSET_KINDS = Object.keys(ASSET_KIND_LABEL) as AssetKind[];

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  em_uso: "Em uso",
  estoque: "Em estoque",
  manutencao: "Manutenção",
  descartado: "Descartado",
};

export const ASSET_STATUSES = Object.keys(ASSET_STATUS_LABEL) as AssetStatus[];

export const ASSET_STATUS_CLASS: Record<AssetStatus, string> = {
  em_uso: "bg-success/15 text-success border-success/30",
  estoque: "bg-info/15 text-info border-info/30",
  manutencao: "bg-warning/15 text-warning border-warning/30",
  descartado: "bg-secondary text-muted-foreground border-border",
};

export const KB_CATEGORIES = [
  "Geral",
  "Hardware",
  "Software",
  "Rede / Internet",
  "Acesso e senhas",
  "E-mail",
  "Impressora",
  "Procedimentos",
] as const;

export function formatDay(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export type SlaState = {
  label: string;
  className: string;
  late: boolean;
  remainingMs: number | null;
};

export function slaState(dueAt: string | null, doneAt: string | null, closed: boolean): SlaState {
  if (!dueAt)
    return { label: "Sem SLA", className: "text-muted-foreground", late: false, remainingMs: null };
  const due = new Date(dueAt).getTime();
  const ref = doneAt ? new Date(doneAt).getTime() : Date.now();
  const diff = due - ref;
  if (doneAt || closed) {
    return diff >= 0
      ? { label: "Dentro do prazo", className: "text-success", late: false, remainingMs: diff }
      : {
          label: `Estourado em ${humanize(-diff)}`,
          className: "text-destructive",
          late: true,
          remainingMs: diff,
        };
  }
  if (diff < 0) {
    return {
      label: `Atrasado ${humanize(-diff)}`,
      className: "text-destructive",
      late: true,
      remainingMs: diff,
    };
  }
  return {
    label: `Faltam ${humanize(diff)}`,
    className: diff < 3_600_000 ? "text-warning" : "text-muted-foreground",
    late: false,
    remainingMs: diff,
  };
}

export function humanize(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
