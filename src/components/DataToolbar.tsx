import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Download, Filter, Plus, Printer, Search, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import {
  OPERATORS,
  OPERATOR_LABEL,
  VALUELESS,
  exportCsv,
  exportPdf,
  newCriterion,
  type MatchMode,
  type SearchCriterion,
  type SearchField,
} from "@/lib/search";

/**
 * A barra de pesquisa do GLPI, reaproveitada por qualquer lista: busca
 * livre, critérios encadeados, buscas salvas e exportação.
 */
export function DataToolbar({
  itemType,
  title,
  fields,
  criteria,
  onCriteriaChange,
  mode,
  onModeChange,
  freeText,
  onFreeTextChange,
  rows,
  columns,
  accessor,
  total,
  shown,
}: {
  /** Identifica o tipo de objeto nas buscas salvas: ticket, asset, contract… */
  itemType: string;
  title: string;
  fields: SearchField[];
  criteria: SearchCriterion[];
  onCriteriaChange: (criteria: SearchCriterion[]) => void;
  mode: MatchMode;
  onModeChange: (mode: MatchMode) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  accessor?: (row: Record<string, unknown>, key: string) => unknown;
  total: number;
  shown: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showCounter, setShowCounter] = useState(false);

  const savedQuery = useQuery({
    queryKey: ["saved_searches", itemType],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("saved_searches")
        .select("*")
        .eq("item_type", itemType)
        .order("sort");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!searchName.trim()) throw new Error("Dê um nome à busca.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await looseDb.from("saved_searches").insert({
        name: searchName.trim(),
        item_type: itemType,
        criteria: criteria as unknown as Record<string, unknown>,
        is_public: isPublic,
        show_counter: showCounter,
        user_id: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Busca salva.");
      setSaving(false);
      setSearchName("");
      queryClient.invalidateQueries({ queryKey: ["saved_searches", itemType] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const removeSaved = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("saved_searches").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved_searches", itemType] }),
  });

  function applySaved(row: LooseRow) {
    const raw = row["criteria"];
    if (Array.isArray(raw)) {
      onCriteriaChange(raw as unknown as SearchCriterion[]);
      setOpen(true);
      toast.success(`Busca "${String(row["name"])}" aplicada.`);
    }
  }

  const update = (id: string, patch: Partial<SearchCriterion>) =>
    onCriteriaChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="panel mb-3">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            placeholder="Buscar em todos os campos..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Button
          size="sm"
          variant={open ? "secondary" : "outline"}
          className="h-8"
          onClick={() => setOpen(!open)}
        >
          <Filter className="size-3.5" /> Pesquisa avançada
          {criteria.length > 0 && (
            <span className="ml-1 rounded-sm bg-primary px-1 text-[0.65rem] text-primary-foreground">
              {criteria.length}
            </span>
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => exportCsv(title, columns, rows, accessor)}
          disabled={rows.length === 0}
        >
          <Download className="size-3.5" /> CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => exportPdf(title, columns, rows, accessor)}
          disabled={rows.length === 0}
        >
          <Printer className="size-3.5" /> PDF
        </Button>

        <span className="ml-auto text-[0.72rem] tabular-nums text-muted-foreground">
          {shown === total ? `${total} registro(s)` : `${shown} de ${total}`}
        </span>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[0.7rem] text-muted-foreground">Combinar critérios com</Label>
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as MatchMode)}
              className="h-7 rounded border border-input bg-background px-2 text-xs"
            >
              <option value="and">E — todos</option>
              <option value="or">OU — qualquer um</option>
            </select>
          </div>

          {criteria.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum critério. Adicione um para refinar a busca.
            </p>
          )}

          {criteria.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <select
                value={c.field}
                onChange={(e) => update(c.id, { field: e.target.value })}
                className="h-8 w-[170px] rounded border border-input bg-background px-2 text-xs"
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={c.operator}
                onChange={(e) =>
                  update(c.id, { operator: e.target.value as SearchCriterion["operator"] })
                }
                className="h-8 w-[140px] rounded border border-input bg-background px-2 text-xs"
              >
                {OPERATORS.map((o) => (
                  <option key={o} value={o}>
                    {OPERATOR_LABEL[o]}
                  </option>
                ))}
              </select>

              {!VALUELESS.includes(c.operator) &&
                (fields.find((f) => f.key === c.field)?.options ? (
                  <select
                    value={c.value}
                    onChange={(e) => update(c.id, { value: e.target.value })}
                    className="h-8 w-[200px] rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Escolha</option>
                    {fields
                      .find((f) => f.key === c.field)
                      ?.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                ) : (
                  <Input
                    value={c.value}
                    onChange={(e) => update(c.id, { value: e.target.value })}
                    placeholder="valor"
                    className="h-8 w-[200px] text-xs"
                  />
                ))}

              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Remover critério"
                onClick={() => onCriteriaChange(criteria.filter((x) => x.id !== c.id))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onCriteriaChange([...criteria, newCriterion(fields[0]?.key ?? "")])}
            >
              <Plus className="size-3.5" /> Adicionar critério
            </Button>
            {criteria.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setSaving(!saving)}
                >
                  <Bookmark className="size-3.5" /> Salvar busca
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => onCriteriaChange([])}
                >
                  Limpar
                </Button>
              </>
            )}
          </div>

          {saving && (
            <div className="flex flex-wrap items-end gap-2 rounded border border-border bg-secondary/40 p-2">
              <div className="space-y-1">
                <Label className="text-[0.7rem] text-muted-foreground">Nome da busca</Label>
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-8 w-[220px] text-xs"
                />
              </div>
              <label className="flex h-8 items-center gap-1.5 text-xs">
                <Checkbox checked={isPublic} onCheckedChange={(v) => setIsPublic(v === true)} />
                Compartilhar com a equipe
              </label>
              <label className="flex h-8 items-center gap-1.5 text-xs">
                <Checkbox
                  checked={showCounter}
                  onCheckedChange={(v) => setShowCounter(v === true)}
                />
                Mostrar contador no painel
              </label>
              <Button size="sm" className="h-8" onClick={() => save.mutate()}>
                Salvar
              </Button>
            </div>
          )}
        </div>
      )}

      {(savedQuery.data ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          <span className="mr-1 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
            Buscas salvas
          </span>
          {(savedQuery.data ?? []).map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-xs"
            >
              <button type="button" onClick={() => applySaved(s)} className="hover:text-link">
                {s["show_counter"] === true && <Star className="mr-1 inline size-3" />}
                {String(s["name"])}
              </button>
              <button
                type="button"
                onClick={() => removeSaved.mutate(s.id)}
                aria-label="Remover busca salva"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
