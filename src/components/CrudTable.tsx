import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";

export type CrudField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "time" | "date" | "datetime";
  options?: { value: string; label: string }[];
  required?: boolean;
  /** Fica no formulário, mas fora da tabela. */
  formOnly?: boolean;
  /** Aparece na tabela, mas não é editável. */
  readOnly?: boolean;
  placeholder?: string;
  render?: (row: LooseRow) => ReactNode;
};

/**
 * Lista + formulário para os cadastros simples do GLPI. As telas com
 * comportamento próprio (regras, notificações) montam a sua interface,
 * mas tudo que é "nome, alguns campos e pronto" passa por aqui.
 */
export function CrudTable({
  table,
  queryKey,
  fields,
  defaults,
  orderBy = "name",
  canWrite,
  emptyText = "Nenhum registro.",
  selectedId,
  onSelect,
  extraActions,
  onChanged,
}: {
  table: string;
  queryKey: string;
  fields: CrudField[];
  defaults: Record<string, unknown>;
  orderBy?: string;
  canWrite: boolean;
  emptyText?: string;
  selectedId?: string | null;
  onSelect?: (row: LooseRow) => void;
  extraActions?: (row: LooseRow) => ReactNode;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LooseRow | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(defaults);

  const listQuery = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await looseDb.from(table).select("*").order(orderBy);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    onChanged?.();
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const f of fields) {
        if (f.required && !String(form[f.key] ?? "").trim()) {
          throw new Error(`Preencha o campo ${f.label}.`);
        }
      }
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.readOnly) continue;
        const value = form[f.key];
        payload[f.key] =
          f.type === "number"
            ? Number(value ?? 0)
            : f.type === "boolean"
              ? value === true
              : value === ""
                ? null
                : value;
      }
      const { error } = editing
        ? await looseDb.from(table).update(payload).eq("id", editing.id)
        : await looseDb.from(table).insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editing ? "Registro atualizado." : "Registro criado.");
      setOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      refresh();
    },
    onError: (e: Error) =>
      toast.error("Não foi possível excluir", {
        description: e.message.includes("violates foreign key")
          ? "Há registros dependendo deste."
          : e.message,
      }),
  });

  const rows = listQuery.data ?? [];
  const columns = fields.filter((f) => !f.formOnly);

  function openNew() {
    setEditing(null);
    setForm(defaults);
    setOpen(true);
  }

  function openEdit(row: LooseRow) {
    setEditing(row);
    const next: Record<string, unknown> = { ...defaults };
    for (const f of fields) next[f.key] = row[f.key] ?? defaults[f.key] ?? "";
    setForm(next);
    setOpen(true);
  }

  return (
    <>
      {canWrite && (
        <div className="mb-2 flex justify-end">
          <Button size="sm" className="h-8" onClick={openNew}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                {columns.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {listQuery.isError && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">
                    A tabela ainda não existe no banco. Aplique a migration da fase 4.
                  </td>
                </tr>
              )}
              {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-muted-foreground">
                    {emptyText}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-selected={row.id === selectedId}
                  className={onSelect ? "cursor-pointer" : undefined}
                  onClick={onSelect ? () => onSelect(row) : undefined}
                >
                  {columns.map((f) => (
                    <td key={f.key} className={f.type === "number" ? "tabular-nums" : undefined}>
                      {f.render ? f.render(row) : formatCell(row[f.key], f)}
                    </td>
                  ))}
                  <td>
                    <div className="flex justify-end gap-1">
                      {extraActions?.(row)}
                      {canWrite && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(row);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove.mutate(row.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar registro" : "Novo registro"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields
              .filter((f) => !f.readOnly)
              .map((f) => (
                <div
                  key={f.key}
                  className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
                >
                  <Label className="text-[0.7rem] text-muted-foreground">
                    {f.label}
                    {f.required ? " *" : ""}
                  </Label>
                  <FieldInput
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => setForm({ ...form, [f.key]: v })}
                  />
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CrudField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex h-8 items-center gap-2 text-xs">
        <Checkbox checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
        Sim
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <Select value={String(value ?? "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return (
      <Textarea
        rows={4}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        className="text-xs"
      />
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "time"
        ? "time"
        : field.type === "date"
          ? "date"
          : field.type === "datetime"
            ? "datetime-local"
            : "text";

  return (
    <Input
      type={inputType}
      value={formatInputValue(value, field)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ""}
      className="h-8 text-xs"
    />
  );
}

function formatInputValue(value: unknown, field: CrudField) {
  if (value === null || value === undefined) return "";
  if (field.type === "datetime" && typeof value === "string" && value.length > 16) {
    return value.slice(0, 16);
  }
  return String(value);
}

function formatCell(value: unknown, field: CrudField) {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "boolean") return value === true ? "Sim" : "Não";
  if (field.type === "select") {
    return field.options?.find((o) => o.value === String(value))?.label ?? String(value);
  }
  if (field.type === "datetime" && typeof value === "string") {
    return new Date(value).toLocaleString("pt-BR");
  }
  if (field.type === "date" && typeof value === "string") {
    return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
  }
  return String(value);
}
