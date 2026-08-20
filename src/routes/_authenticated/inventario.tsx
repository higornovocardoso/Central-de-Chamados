import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import {
  ASSET_KIND_LABEL,
  ASSET_KINDS,
  ASSET_STATUS_CLASS,
  ASSET_STATUS_LABEL,
  ASSET_STATUSES,
  formatDay,
  type AssetKind,
  type AssetStatus,
} from "@/lib/glpi";
import { Tag } from "@/components/Tag";
import { DataToolbar } from "@/components/DataToolbar";
import { applySearch, type MatchMode, type SearchCriterion } from "@/lib/search";

type InventarioSearch = { tipo?: string | undefined };

export const Route = createFileRoute("/_authenticated/inventario")({
  validateSearch: (search: Record<string, unknown>): InventarioSearch => {
    const tipo = search["tipo"];
    return typeof tipo === "string" && (tipo === "todos" || ASSET_KINDS.includes(tipo as AssetKind))
      ? { tipo }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Inventário de ativos — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Cadastro completo do parque de T.I.: computadores, monitores, impressoras, licenças, garantias e responsáveis.",
      },
      { property: "og:title", content: "Inventário de ativos — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Controle o patrimônio de T.I. com garantia, local, setor e responsável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inventario,
});

type AssetRow = {
  id: string;
  name: string;
  asset_tag: string;
  kind: AssetKind;
  status: AssetStatus;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string | null;
  warranty_end: string | null;
  location_id: string | null;
  sector_id: string | null;
  supplier_id: string | null;
  assigned_name: string;
  notes: string;
};

const EMPTY: Omit<AssetRow, "id"> = {
  name: "",
  asset_tag: "",
  kind: "computador",
  status: "em_uso",
  brand: "",
  model: "",
  serial_number: "",
  purchase_date: null,
  warranty_end: null,
  location_id: null,
  sector_id: null,
  supplier_id: null,
  assigned_name: "",
  notes: "",
};

const NONE = "__none__";

function Inventario() {
  const { isStaff } = useRoles();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { tipo } = Route.useSearch();
  const navigate = useNavigate();
  const kind = tipo ?? "todos";
  const [status, setStatus] = useState("todos");
  const [criteria, setCriteria] = useState<SearchCriterion[]>([]);
  const [mode, setMode] = useState<MatchMode>("and");

  // O tipo vive na URL para que o submenu "Ativos" da lateral aponte direto para ele.
  const setKind = (value: string) =>
    navigate({ to: "/inventario", search: { tipo: value === "todos" ? undefined : value } });
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<AssetRow, "id">>(EMPTY);

  const assetsQuery = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id,name,asset_tag,kind,status,brand,model,serial_number,purchase_date,warranty_end,location_id,sector_id,supplier_id,assigned_name,notes",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AssetRow[];
    },
  });

  const lookups = useQuery({
    queryKey: ["lookups"],
    queryFn: async () => {
      const [locations, sectors, suppliers] = await Promise.all([
        supabase.from("locations").select("id,name").order("name"),
        supabase.from("sectors").select("id,name").order("name"),
        supabase.from("suppliers").select("id,name").order("name"),
      ]);
      return {
        locations: locations.data ?? [],
        sectors: sectors.data ?? [],
        suppliers: suppliers.data ?? [],
      };
    },
  });

  const nameOf = (list: { id: string; name: string }[] | undefined, id: string | null) =>
    (id && list?.find((l) => l.id === id)?.name) || "—";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do ativo.");
      const payload = { ...form, name: form.name.trim() };
      // O types.ts gerado ainda tem os 8 tipos antigos; a fase 5 traz 19.
      if (editing) {
        const { error } = await supabase
          .from("assets")
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Ativo atualizado." : "Ativo cadastrado.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ativo removido.");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(asset: AssetRow) {
    const { id: _id, ...rest } = asset;
    setEditing(asset);
    setForm(rest);
    setOpen(true);
  }

  /** Campos que a barra de pesquisa oferece, no formato do GLPI. */
  const searchFields = useMemo(
    () => [
      { key: "name", label: "Nome" },
      { key: "asset_tag", label: "Patrimônio" },
      { key: "serial_number", label: "Número de série" },
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modelo" },
      { key: "assigned_name", label: "Responsável" },
      {
        key: "kind",
        label: "Tipo",
        options: ASSET_KINDS.map((k) => ({ value: k, label: ASSET_KIND_LABEL[k] })),
      },
      {
        key: "status",
        label: "Situação",
        options: ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABEL[s] })),
      },
      { key: "notes", label: "Observações" },
    ],
    [],
  );

  const byKindAndStatus = useMemo(
    () =>
      (assetsQuery.data ?? []).filter(
        (a) => (kind === "todos" || a.kind === kind) && (status === "todos" || a.status === status),
      ),
    [assetsQuery.data, kind, status],
  );

  const filtered = useMemo(
    () =>
      applySearch(
        byKindAndStatus as unknown as Record<string, unknown>[],
        criteria,
        searchFields,
        mode,
        search,
      ) as unknown as AssetRow[],
    [byKindAndStatus, criteria, searchFields, mode, search],
  );

  return (
    <AppShell
      title={kind === "todos" ? "Ativos" : ASSET_KIND_LABEL[kind as AssetKind]}
      subtitle="Parque de T.I. com patrimônio, garantia, local e responsável."
      breadcrumbTail={kind === "todos" ? undefined : ASSET_KIND_LABEL[kind as AssetKind]}
      actions={
        isStaff ? (
          <>
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link to="/inventario/importar">Importar CSV</Link>
            </Button>
            <Button size="sm" className="h-8" onClick={openNew}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </>
        ) : null
      }
    >

      <DataToolbar
        itemType="asset"
        title="Inventário de ativos"
        fields={searchFields}
        criteria={criteria}
        onCriteriaChange={setCriteria}
        mode={mode}
        onModeChange={setMode}
        freeText={search}
        onFreeTextChange={setSearch}
        rows={filtered as unknown as Record<string, unknown>[]}
        columns={[
          { key: "name", label: "Nome" },
          { key: "asset_tag", label: "Patrimônio" },
          { key: "kind", label: "Tipo" },
          { key: "brand", label: "Marca" },
          { key: "model", label: "Modelo" },
          { key: "serial_number", label: "Série" },
          { key: "assigned_name", label: "Responsável" },
        ]}
        accessor={(row, key) =>
          key === "kind" ? ASSET_KIND_LABEL[String(row["kind"]) as AssetKind] : row[key]
        }
        total={(assetsQuery.data ?? []).length}
        shown={filtered.length}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {ASSET_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {ASSET_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ASSET_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="panel overflow-hidden">
        {assetsQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando inventário...</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Monitor className="mx-auto mb-2 size-6 opacity-60" />
            Nenhum ativo cadastrado ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/inventario/$id"
                      params={{ id: a.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.asset_tag || "sem patrimônio"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ASSET_KIND_LABEL[a.kind]} · {a.brand || "—"} {a.model} · série{" "}
                    {a.serial_number || "—"} · {nameOf(lookups.data?.locations, a.location_id)} ·{" "}
                    {nameOf(lookups.data?.sectors, a.sector_id)} ·{" "}
                    {a.assigned_name ? `resp. ${a.assigned_name}` : "sem responsável"} · garantia até{" "}
                    {formatDay(a.warranty_end)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag className={ASSET_STATUS_CLASS[a.status]}>{ASSET_STATUS_LABEL[a.status]}</Tag>
                  {isStaff && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)} aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove.mutate(a.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Patrimônio">
              <Input
                value={form.asset_tag}
                onChange={(e) => setForm({ ...form, asset_tag: e.target.value })}
              />
            </Field>
            <Field label="Tipo">
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as AssetKind })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ASSET_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Situação">
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as AssetStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ASSET_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Marca">
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="Modelo">
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="Número de série">
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
            </Field>
            <Field label="Responsável">
              <Input
                value={form.assigned_name}
                onChange={(e) => setForm({ ...form, assigned_name: e.target.value })}
              />
            </Field>
            <Field label="Data de compra">
              <Input
                type="date"
                value={form.purchase_date ?? ""}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })}
              />
            </Field>
            <Field label="Fim da garantia">
              <Input
                type="date"
                value={form.warranty_end ?? ""}
                onChange={(e) => setForm({ ...form, warranty_end: e.target.value || null })}
              />
            </Field>
            <Field label="Local">
              <LookupSelect
                value={form.location_id}
                options={lookups.data?.locations ?? []}
                onChange={(v) => setForm({ ...form, location_id: v })}
              />
            </Field>
            <Field label="Setor">
              <LookupSelect
                value={form.sector_id}
                options={lookups.data?.sectors ?? []}
                onChange={(v) => setForm({ ...form, sector_id: v })}
              />
            </Field>
            <Field label="Fornecedor">
              <LookupSelect
                value={form.supplier_id}
                options={lookups.data?.suppliers ?? []}
                onChange={(v) => setForm({ ...form, supplier_id: v })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observações">
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function LookupSelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Não definido</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
