import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { ASSET_KINDS, ASSET_KIND_LABEL } from "@/lib/glpi";
import { IMPORT_COLUMNS, parseCsv } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/inventario/importar")({
  head: () => ({
    meta: [
      { title: "Importar ativos — Helpdesk T.I." },
      {
        name: "description",
        content: "Cadastro de ativos em massa a partir de um arquivo CSV.",
      },
    ],
  }),
  component: Importar,
});

type Parsed = { row: Record<string, string>; error?: string };

function Importar() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canImport = can("computer", "create");
  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState("");

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      setFileName(file.name);
      setRows(
        parsed.map((row) => {
          if (!row["nome"]?.trim()) return { row, error: "Sem o campo nome" };
          const kind = row["tipo"]?.trim().toLowerCase();
          if (kind && !ASSET_KINDS.includes(kind as never)) {
            return { row, error: `Tipo "${kind}" não existe` };
          }
          return { row };
        }),
      );
    };
    reader.readAsText(file, "UTF-8");
  }

  const importRows = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => !r.error);
      if (valid.length === 0) throw new Error("Nenhuma linha válida para importar.");

      const payload = valid.map(({ row }) => ({
        name: (row["nome"] ?? "").trim(),
        asset_tag: row["patrimonio"]?.trim() ?? "",
        kind: (row["tipo"]?.trim().toLowerCase() || "computador") as never,
        serial_number: row["numero_serie"]?.trim() ?? "",
        brand: row["marca"]?.trim() ?? "",
        model: row["modelo"]?.trim() ?? "",
        assigned_name: row["responsavel"]?.trim() ?? "",
        purchase_date: row["data_compra"]?.trim() || null,
        warranty_end: row["fim_garantia"]?.trim() || null,
        notes: row["observacoes"]?.trim() ?? "",
      }));

      const { error } = await supabase.from("assets").insert(payload as never);
      if (error) throw new Error(error.message);
      return valid.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} ativo(s) importado(s).`);
      setRows([]);
      setFileName("");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error("Falha na importação", { description: e.message }),
  });

  const valid = rows.filter((r) => !r.error).length;
  const invalid = rows.length - valid;

  function downloadTemplate() {
    const header = IMPORT_COLUMNS.map((c) => c.label).join(";");
    const example = [
      "Notebook do financeiro",
      "PAT-0042",
      "notebook",
      "SN123456",
      "Dell",
      "Latitude 3420",
      "Maria Silva",
      "2026-03-15",
      "2029-03-15",
      "Comprado com a nota 8891",
    ].join(";");
    const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-ativos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Importar ativos"
      subtitle="O substituto do inventário automático: um CSV com o parque inteiro."
      breadcrumbTail="Importar"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <section className="panel p-4">
            <Label className="text-[0.7rem] text-muted-foreground">Arquivo CSV</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="mt-1 h-9 text-xs"
              disabled={!canImport}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            {fileName && (
              <p className="mt-2 text-xs text-muted-foreground">
                <FileUp className="mr-1 inline size-3.5" />
                {fileName} — {rows.length} linha(s), {valid} válida(s)
                {invalid > 0 ? `, ${invalid} com problema` : ""}
              </p>
            )}
          </section>

          {rows.length > 0 && (
            <section className="panel overflow-hidden">
              <header className="panel-header">
                Conferência
                <Button
                  size="sm"
                  className="ml-auto h-7"
                  disabled={valid === 0 || importRows.isPending}
                  onClick={() => importRows.mutate()}
                >
                  <Upload className="size-3.5" /> Importar {valid} ativo(s)
                </Button>
              </header>
              <div className="max-h-[420px] overflow-auto">
                <table className="glpi-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Patrimônio</th>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Responsável</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, index) => (
                      <tr key={index}>
                        <td className="font-medium">{r.row["nome"] || "—"}</td>
                        <td>{r.row["patrimonio"] || "—"}</td>
                        <td>{r.row["tipo"] || "computador"}</td>
                        <td>{r.row["marca"] || "—"}</td>
                        <td>{r.row["responsavel"] || "—"}</td>
                        <td>
                          {r.error ? (
                            <span className="text-destructive">{r.error}</span>
                          ) : (
                            <span className="text-success">pronta</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-3">
          <section className="panel p-4">
            <h2 className="mb-2 text-xs font-semibold">Como montar o arquivo</h2>
            <p className="mb-2 text-[0.72rem] text-muted-foreground">
              A primeira linha precisa ser o cabeçalho, com estes nomes de coluna. O separador pode
              ser vírgula ou ponto e vírgula — o que o Excel brasileiro usa.
            </p>
            <ul className="space-y-0.5 text-[0.72rem]">
              {IMPORT_COLUMNS.map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span className="font-mono">{c.label}</span>
                  <span className="text-muted-foreground">
                    {c.required ? "obrigatório" : "opcional"}
                  </span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" className="mt-3 h-8 w-full" onClick={downloadTemplate}>
              Baixar modelo
            </Button>
          </section>

          <section className="panel p-4">
            <h2 className="mb-2 text-xs font-semibold">Tipos aceitos na coluna tipo</h2>
            <p className="text-[0.72rem] text-muted-foreground">
              {ASSET_KINDS.map((k) => ASSET_KIND_LABEL[k]).join(" · ")}
            </p>
            <p className="mt-2 text-[0.72rem] text-muted-foreground">
              Use o valor interno em minúsculo: <code>computador</code>, <code>notebook</code>,{" "}
              <code>monitor</code>, <code>impressora</code>, <code>rede</code>,{" "}
              <code>telefonia</code>, <code>periferico</code>. Em branco, entra como computador.
            </p>
          </section>

          <section className="panel p-4 text-[0.72rem] text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Sobre campos travados</p>
            <p>
              A importação cria registros novos. Para atualizar em massa sem perder correções
              feitas à mão, trave os campos na aba Bloqueios da ficha do ativo.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
