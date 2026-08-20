import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros — Helpdesk T.I." },
      {
        name: "description",
        content:
          "Gerencie locais, setores e fornecedores usados nos chamados e no inventário de T.I.",
      },
      { property: "og:title", content: "Cadastros — Helpdesk T.I." },
      {
        property: "og:description",
        content: "Locais, setores e fornecedores do helpdesk de T.I.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cadastros,
});

type EntityConfig = {
  table: "locations" | "sectors" | "suppliers";
  title: string;
  fields: { key: string; label: string }[];
};

const CONFIGS: EntityConfig[] = [
  {
    table: "locations",
    title: "Locais",
    fields: [
      { key: "name", label: "Nome *" },
      { key: "building", label: "Prédio / andar" },
      { key: "notes", label: "Observações" },
    ],
  },
  {
    table: "sectors",
    title: "Setores",
    fields: [
      { key: "name", label: "Nome *" },
      { key: "manager", label: "Responsável" },
    ],
  },
  {
    table: "suppliers",
    title: "Fornecedores",
    fields: [
      { key: "name", label: "Nome *" },
      { key: "contact_email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "notes", label: "Observações" },
    ],
  },
];

function Cadastros() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Cadastros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estruturas usadas nos chamados e no inventário.
        </p>
      </div>
      <Tabs defaultValue="locations">
        <TabsList>
          {CONFIGS.map((c) => (
            <TabsTrigger key={c.table} value={c.table}>
              {c.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {CONFIGS.map((c) => (
          <TabsContent key={c.table} value={c.table} className="mt-4">
            <EntityManager config={c} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

type Row = Record<string, string> & { id: string };

function EntityManager({ config }: { config: EntityConfig }) {
  const { isStaff } = useRoles();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: [config.table],
    queryFn: async () => {
      const { data, error } = await supabase.from(config.table).select("*").order("name");
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form["name"]?.trim()) throw new Error("Informe o nome.");
      const payload: Record<string, string> = {};
      for (const f of config.fields) payload[f.key] = (form[f.key] ?? "").trim();
      if (editing) {
        const { error } = await supabase.from(config.table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(config.table) as never as {
          insert: (v: Record<string, string>) => Promise<{ error: Error | null }>;
        }).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cadastro salvo.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: [config.table] });
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(config.table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      queryClient.invalidateQueries({ queryKey: [config.table] });
      queryClient.invalidateQueries({ queryKey: ["lookups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = listQuery.data ?? [];

  return (
    <div>
      {isStaff && (
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm({});
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      )}
      <div className="panel overflow-hidden">
        {listQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r["name"]}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.fields
                      .slice(1)
                      .map((f) => r[f.key])
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                {isStaff && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar"
                      onClick={() => {
                        setEditing(r);
                        setForm(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Adicionar"} — {config.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {config.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
