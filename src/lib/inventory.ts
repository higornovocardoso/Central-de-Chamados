import type { AssetKind } from "@/lib/glpi";

/** Vocabulário do inventário do GLPI. */

export type ComponentKind =
  | "processador"
  | "memoria"
  | "disco"
  | "placa_rede"
  | "placa_video"
  | "placa_som"
  | "controladora"
  | "bateria"
  | "fonte"
  | "bios"
  | "gabinete_componente"
  | "outro";

export const COMPONENT_KIND_LABEL: Record<ComponentKind, string> = {
  processador: "Processador",
  memoria: "Memória",
  disco: "Disco",
  placa_rede: "Placa de rede",
  placa_video: "Placa de vídeo",
  placa_som: "Placa de som",
  controladora: "Controladora",
  bateria: "Bateria",
  fonte: "Fonte",
  bios: "BIOS",
  gabinete_componente: "Gabinete",
  outro: "Outro",
};

export const COMPONENT_KINDS = Object.keys(COMPONENT_KIND_LABEL) as ComponentKind[];

export type NetworkPortType = "ethernet" | "wifi" | "loopback" | "alias" | "agregado" | "fibra";

export const PORT_TYPE_LABEL: Record<NetworkPortType, string> = {
  ethernet: "Ethernet",
  wifi: "Wi-Fi",
  loopback: "Loopback",
  alias: "Alias",
  agregado: "Agregado",
  fibra: "Fibra",
};

export const PORT_TYPES = Object.keys(PORT_TYPE_LABEL) as NetworkPortType[];

export const DEPRECIATION_LABEL: Record<string, string> = {
  linear: "Linear",
  decrescente: "Decrescente",
  nenhuma: "Sem depreciação",
};

/**
 * Quais abas fazem sentido para cada tipo de ativo. O GLPI mostra abas
 * diferentes por tipo — um monitor não tem volume nem componente.
 */
export const KIND_TABS: Record<string, string[]> = {
  computador: [
    "componentes",
    "volumes",
    "sistema",
    "softwares",
    "conexoes",
    "portas",
    "financeiro",
  ],
  notebook: ["componentes", "volumes", "sistema", "softwares", "conexoes", "portas", "financeiro"],
  monitor: ["conexoes", "financeiro"],
  impressora: ["cartuchos", "contadores", "conexoes", "portas", "financeiro"],
  rede: ["portas", "componentes", "financeiro"],
  periferico: ["conexoes", "financeiro"],
  telefonia: ["conexoes", "financeiro"],
  rack: ["rack", "financeiro"],
  gabinete: ["financeiro"],
  pdu: ["financeiro"],
  passivo: ["portas", "financeiro"],
  cabo: ["financeiro"],
  sim_card: ["financeiro"],
  nao_gerenciado: ["portas"],
  software: [],
  cartucho: [],
  consumivel: [],
  licenca: ["financeiro"],
  outro: ["financeiro"],
};

export function tabsFor(kind: AssetKind | string) {
  return KIND_TABS[kind] ?? ["financeiro"];
}

export function formatBytes(megabytes: number) {
  if (!megabytes) return "—";
  if (megabytes < 1024) return `${megabytes} MB`;
  const gb = megabytes / 1024;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

export function formatMoneyBR(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Colunas aceitas na importação por CSV. O cabeçalho do arquivo precisa usar
 * exatamente estes nomes; qualquer coluna desconhecida é ignorada.
 */
