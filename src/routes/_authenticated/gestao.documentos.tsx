import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/gestao/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — Helpdesk T.I." },
      {
        name: "description",
        content: "Notas fiscais, manuais e termos, anexados a chamados e ativos.",
      },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();
  const queryClient = useQueryClient();
  const canWrite = can("document", "create");
  const [uploading, setUploading] = useState(false);
  const [heading, setHeading] = useState("");

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const linksQuery = useQuery({
    queryKey: ["document_items"],
    queryFn: async () => {
      const { data } = await looseDb.from("document_items").select("*").order("id");
      return data ?? [];
    },
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = `avulsos/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, file);
      if (storageError) throw new Error(storageError.message);

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await looseDb.from("documents").insert({
        name: file.name,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: path,
        heading_id: heading || null,
        entity_id: entities[0]?.value ?? null,
        uploaded_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);

      toast.success("Documento enviado.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error("Falha ao enviar", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("documents").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Documento removido.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("documentos").download(path);
    if (error || !data) {
      toast.error("Falha ao baixar", { description: error?.message });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const usageOf = (documentId: string) =>
    (linksQuery.data ?? []).filter((l) => l["document_id"] === documentId).length;

  const headingName = (id: unknown) =>
    options.headings.find((h) => h.value === String(id))?.label ?? "Sem rubrica";

  return (
    <AppShell
      title="Documentos"
      subtitle="Notas fiscais, manuais e termos — anexáveis a chamados, ativos e contratos."
      breadcrumbTail="Documentos"
    >
      {canWrite && (
        <section className="panel mb-3 p-3">
          <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Rubrica</Label>
              <select
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
              >
                <option value="">Sem rubrica</option>
                {options.headings.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Arquivo</Label>
              <Input
                type="file"
                className="h-8 text-xs"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </section>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Rubrica</th>
                <th>Tamanho</th>
                <th>Vínculos</th>
                <th>Enviado em</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {documentsQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    A tabela de documentos ainda não existe no banco.
                  </td>
                </tr>
              )}
              {(documentsQuery.data ?? []).length === 0 && !documentsQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 size-5 opacity-60" />
                    Nenhum documento enviado.
                  </td>
                </tr>
              )}
              {(documentsQuery.data ?? []).map((d) => (
                <tr key={d.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => download(String(d["storage_path"]), String(d["filename"]))}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Paperclip className="size-3.5" />
                      {String(d["name"])}
                    </button>
                  </td>
                  <td>{headingName(d["heading_id"])}</td>
                  <td className="tabular-nums">
                    {Math.round(Number(d["size_bytes"] ?? 0) / 1024)} KB
                  </td>
                  <td className="tabular-nums">{usageOf(d.id)}</td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {formatDate(String(d["created_at"]))}
                  </td>
                  <td>
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label="Remover documento"
                        onClick={() => remove.mutate(d.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Para anexar a um chamado específico, use a aba Documentos dentro do chamado. Aqui ficam os
        documentos avulsos e o inventário geral do que foi enviado.
      </p>
    </AppShell>
  );
}
