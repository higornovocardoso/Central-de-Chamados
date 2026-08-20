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
export const IMPORT_COLUMNS = [
  { key: "name", label: "nome", required: true },
  { key: "asset_tag", label: "patrimonio", required: false },
  { key: "kind", label: "tipo", required: false },
  { key: "serial_number", label: "numero_serie", required: false },
  { key: "brand", label: "marca", required: false },
  { key: "model", label: "modelo", required: false },
  { key: "assigned_name", label: "responsavel", required: false },
  { key: "purchase_date", label: "data_compra", required: false },
  { key: "warranty_end", label: "fim_garantia", required: false },
  { key: "notes", label: "observacoes", required: false },
];

/** Lê um CSV simples com separador , ou ; e aspas duplas. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const separator = text.split("\n")[0]?.includes(";") ? ";" : ",";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  if (!header) return [];

  return body.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name.trim().toLowerCase()] = cells[index] ?? "";
    });
    return record;
  });
}
