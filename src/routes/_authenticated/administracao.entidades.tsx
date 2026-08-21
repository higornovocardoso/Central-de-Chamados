import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, type EntityRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/administracao/entidades")({
  head: () => ({
    meta: [
      { title: "Entidades — Helpdesk T.I." },
      {
        name: "description",
        content: "Árvore de entidades: empresas, filiais e departamentos, com herança.",
      },
    ],
  }),
  component: Entidades,
});

const ROOT = "__root__";

const EMPTY = {
  name: "",
  parent_id: ROOT,
  comment: "",
  phone: "",
  administrative_number: "",
  fax: "",
  website: "",
  email: "",
  postal_code: "",
  address: "",
  city: "",
  state: "",
  country: "",
};

type FormState = typeof EMPTY;

function Entidades() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const entitiesQuery = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await db.from("entities").select("*").order("path");
      if (error) throw new Error(error.message);
      return (data ?? []) as EntityRow[];
    },
  });

  const entities = entitiesQuery.data ?? [];

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome da entidade.");
      const payload = {
        name: form.name.trim(),
        parent_id: form.parent_id === ROOT ? null : form.parent_id,
        comment: form.comment,
        phone: form.phone,
        administrative_number: form.administrative_number,
        fax: form.fax,
        website: form.website,
        email: form.email,
        postal_code: form.postal_code,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
      };
      const { error } = editing
        ? await db.from("entities").update(payload).eq("id", editing.id)
        : await db.from("entities").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editing ? "Entidade atualizada." : "Entidade criada.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("entities").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Entidade excluída.");
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível excluir", {
        description: e.message.includes("violates foreign key")
          ? "A entidade tem registros ou entidades filhas vinculadas."
          : e.message,
      }),
  });

  function openNew(parentId?: string) {
    setEditing(null);
    setForm({ ...EMPTY, parent_id: parentId ?? ROOT });
    setOpen(true);
  }

  function openEdit(entity: EntityRow) {
    setEditing(entity);
    setForm({
      name: entity.name,
      parent_id: entity.parent_id ?? ROOT,
      comment: entity.comment,
      phone: entity.phone,
      administrative_number: entity.administrative_number,
      fax: entity.fax,
      website: entity.website,
      email: entity.email,
      postal_code: entity.postal_code,
      address: entity.address,
      city: entity.city,
      state: entity.state,
      country: entity.country,
    });
    setOpen(true);
  }

  // Uma entidade não pode virar filha de si mesma nem de uma descendente.
  const parentOptions = entities.filter(
    (e) => !editing || (e.id !== editing.id && !e.path.startsWith(editing.path)),
  );

  return (
    <AppShell
      title="Entidades"
      subtitle="Árvore de empresas, filiais e departamentos. Cada entidade enxerga a si e às suas filhas."
      breadcrumbTail="Entidades"
      actions={
        can("entity", "create") ? (
          <Button size="sm" className="h-8" onClick={() => openNew()}>
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null
      }
    >
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Comentário</th>
                <th>Cidade</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {entitiesQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Carregando entidades...
                  </td>
                </tr>
              )}
              {entitiesQuery.isError && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    A tabela de entidades ainda não existe no banco. Aplique a migration da fase 2.
                  </td>
                </tr>
              )}
              {entities.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ paddingLeft: `${e.level * 18}px` }}
                    >
                      {e.level > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{e.name}</span>
                      {e.parent_id === null && (
                        <span className="rounded-sm bg-secondary px-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                          raiz
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate text-muted-foreground">
                    {e.comment || "—"}
                  </td>
                  <td>{e.city || "—"}</td>
                  <td>{e.email || "—"}</td>
                  <td>{e.phone || "—"}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {can("entity", "create") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Adicionar entidade filha"
                          onClick={() => openNew(e.id)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      )}
                      {can("entity", "update") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Editar"
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {can("entity", "delete") && e.parent_id !== null && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Excluir"
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entidade" : "Nova entidade"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral">
            <TabsList className="min-h-8">
              <TabsTrigger value="geral" className="text-xs">
                Entidade
              </TabsTrigger>
              <TabsTrigger value="endereco" className="text-xs">
                Endereço
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="mt-3 space-y-3">
              <Field label="Nome *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="Como filha de">
                <Select
                  value={form.parent_id}
                  onValueChange={(v) => setForm({ ...form, parent_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROOT}>Nenhuma (entidade raiz)</SelectItem>
                    {parentOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {" ".repeat(e.level * 3)}
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Comentário">
                <Textarea
                  rows={3}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="text-xs"
                />
              </Field>
            </TabsContent>

            <TabsContent value="endereco" className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Telefone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Número administrativo">
                  <Input
                    value={form.administrative_number}
                    onChange={(e) => setForm({ ...form, administrative_number: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Fax">
                  <Input
                    value={form.fax}
                    onChange={(e) => setForm({ ...form, fax: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Site">
                  <Input
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="CEP">
                  <Input
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Endereço" className="sm:col-span-2">
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Cidade">
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Estado">
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="País">
                  <Input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
            </TabsContent>
          </Tabs>

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
    </AppShell>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[0.7rem] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
