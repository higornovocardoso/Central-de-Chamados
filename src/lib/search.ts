/**
 * O motor de busca do GLPI, na versão que roda no navegador: critérios de
 * campo + operador + valor, combinados por E ou OU, aplicados a qualquer
 * lista já carregada. Serve também de base para as buscas salvas.
 */

export type SearchOperator =
  | "contem"
  | "nao_contem"
  | "igual"
  | "diferente"
  | "comeca_com"
  | "termina_com"
  | "maior"
  | "menor"
  | "vazio"
  | "preenchido";

export const OPERATOR_LABEL: Record<SearchOperator, string> = {
  contem: "contém",
  nao_contem: "não contém",
  igual: "é",
  diferente: "não é",
  comeca_com: "começa com",
  termina_com: "termina com",
  maior: "maior que",
  menor: "menor que",
  vazio: "está vazio",
  preenchido: "está preenchido",
};

export const OPERATORS = Object.keys(OPERATOR_LABEL) as SearchOperator[];

/** Operadores que não pedem valor. */
export const VALUELESS: SearchOperator[] = ["vazio", "preenchido"];

export type SearchCriterion = {
  id: string;
  field: string;
  operator: SearchOperator;
  value: string;
};

export type SearchField = {
  key: string;
  label: string;
  /** Como ler o campo de uma linha; por padrão lê a própria chave. */
  accessor?: (row: Record<string, unknown>) => unknown;
  options?: { value: string; label: string }[];
};

export type MatchMode = "and" | "or";

function textOf(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matchOne(raw: unknown, criterion: SearchCriterion) {
  const value = textOf(raw).toLowerCase();
  const wanted = criterion.value.trim().toLowerCase();

  switch (criterion.operator) {
    case "vazio":
      return value.length === 0;
    case "preenchido":
      return value.length > 0;
    case "contem":
      return value.includes(wanted);
    case "nao_contem":
      return !value.includes(wanted);
    case "igual":
      return value === wanted;
    case "diferente":
      return value !== wanted;
    case "comeca_com":
      return value.startsWith(wanted);
    case "termina_com":
      return value.endsWith(wanted);
    case "maior":
      return Number(value) > Number(wanted);
    case "menor":
      return Number(value) < Number(wanted);
    default:
      return true;
  }
}

/** Aplica os critérios a uma lista já carregada. */
export function applySearch<T extends Record<string, unknown>>(
  rows: T[],
  criteria: SearchCriterion[],
  fields: SearchField[],
  mode: MatchMode = "and",
  freeText = "",
): T[] {
  const active = criteria.filter(
    (c) => VALUELESS.includes(c.operator) || c.value.trim().length > 0,
  );
  const needle = freeText.trim().toLowerCase();

  return rows.filter((row) => {
    if (needle) {
      const haystack = fields
        .map((f) => textOf(f.accessor ? f.accessor(row) : row[f.key]))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (active.length === 0) return true;

    const results = active.map((c) => {
      const field = fields.find((f) => f.key === c.field);
      const raw = field?.accessor ? field.accessor(row) : row[c.field];
      return matchOne(raw, c);
    });

    return mode === "or" ? results.some(Boolean) : results.every(Boolean);
  });
}

export function newCriterion(field: string): SearchCriterion {
  return {
    id: Math.random().toString(36).slice(2),
    field,
    operator: "contem",
    value: "",
  };
}

/** CSV com BOM e ponto e vírgula, que é o que o Excel brasileiro espera. */
export function exportCsv(
  filename: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  accessor?: (row: Record<string, unknown>, key: string) => unknown,
) {
  const head = columns.map((c) => c.label);
  const body = rows.map((row) =>
    columns.map((c) => textOf(accessor ? accessor(row, c.key) : row[c.key])),
  );

  const csv = [head, ...body]
    .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/**
 * PDF pela janela de impressão do navegador. Não é uma biblioteca de PDF,
 * é o caminho que o próprio sistema operacional já oferece — e que gera um
 * arquivo idêntico ao que o usuário vê.
 */
export function exportPdf(
  title: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  accessor?: (row: Record<string, unknown>, key: string) => unknown,
) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;

  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (c) => `<td>${escapeHtml(textOf(accessor ? accessor(row, c.key) : row[c.key]))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; font-size: 11px; margin: 24px; color: #14201e; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      p.meta { color: #666; margin: 0 0 16px; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #eee; text-align: left; padding: 6px; border-bottom: 1px solid #999; }
      td { padding: 5px 6px; border-bottom: 1px solid #ddd; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${rows.length} registro(s) · gerado em ${new Date().toLocaleString("pt-BR")}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
