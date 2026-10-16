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
import { db, type EntityEmailDomainRow, type EntityRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas" },
      {
        name: "description",
        content: "Empresas, filiais e departamentos, com herança.",
      },
    ],
  }),
  component: Entidades,
});

const ROOT = "__root__";

const EMPTY = {
  name: "",
  parent_id: ROOT,
  accepts_public_tickets: false,
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
  const [newDomain, setNewDomain] = useState("");

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
      if (!form.name.trim()) throw new Error("Informe o nome da empresa.");
      const payload = {
        name: form.name.trim(),
        parent_id: form.parent_id === ROOT ? null : form.parent_id,
        accepts_public_tickets: form.accepts_public_tickets,
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
      toast.success(editing ? "Empresa atualizada." : "Empresa criada.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  // Os domínios só existem para entidade já gravada: antes de salvar não há
  // id a que vinculá-los.
  const domainsQuery = useQuery({
    queryKey: ["entity_email_domains", editing?.id],
    enabled: Boolean(editing?.id),
    queryFn: async () => {
      const { data, error } = await db
        .from("entity_email_domains")
        .select("*")
        .eq("entity_id", editing!.id)
        .order("domain");
      if (error) throw new Error(error.message);
      return (data ?? []) as EntityEmailDomainRow[];
    },
  });

  const addDomain = useMutation({
    mutationFn: async () => {
      // O banco exige minúsculas e sem espaço. Normalizar aqui evita que o
      // usuário leve um erro de restrição por ter digitado "Empresa.COM ".
      const limpo = newDomain
        .trim()
        .toLowerCase()
        .replace(/^@+/, "")
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
      if (!limpo.includes(".") || limpo.includes("@")) {
        throw new Error("Informe apenas o domínio, como empresa.com.br");
      }
      const { error } = await db
        .from("entity_email_domains")
        .insert({ entity_id: editing!.id, domain: limpo });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewDomain("");
      queryClient.invalidateQueries({ queryKey: ["entity_email_domains"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível adicionar", {
        description: e.message.includes("duplicate key")
          ? "Este domínio já está cadastrado, aqui ou em outra empresa. Cada domínio pertence a uma só."
          : e.message,
      }),
  });

  const removeDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("entity_email_domains").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entity_email_domains"] }),
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("entities").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Empresa excluída.");
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível excluir", {
        description: e.message.includes("violates foreign key")
          ? "A empresa tem registros ou filiais vinculadas."
          : e.message,
      }),
  });

  function openNew(parentId?: string) {
    setNewDomain("");
    setEditing(null);
    setForm({ ...EMPTY, parent_id: parentId ?? ROOT });
    setOpen(true);
  }

  function openEdit(entity: EntityRow) {
    setNewDomain("");
    setEditing(entity);
    setForm({
      name: entity.name,
      parent_id: entity.parent_id ?? ROOT,
      accepts_public_tickets: entity.accepts_public_tickets ?? false,
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
      title="Empresas"
      subtitle="Empresas, filiais e departamentos. Cada empresa enxerga a si e às suas filiais."
      breadcrumbTail="Empresas"
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
                    Carregando empresas...
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
                          aria-label="Adicionar filial"
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
            <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral">
            <TabsList className="min-h-8">
              <TabsTrigger value="geral" className="text-xs">
                Empresa
              </TabsTrigger>
              <TabsTrigger value="endereco" className="text-xs">
                Endereço
              </TabsTrigger>
              <TabsTrigger value="publico" className="text-xs">
                Chamado público
              </TabsTrigger>
            </TabsList>

            <TabsContent value="publico" className="mt-3 space-y-4">
              <label className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={form.accepts_public_tickets}
                  onChange={(e) => setForm({ ...form, accepts_public_tickets: e.target.checked })}
                />
                <span className="text-xs">
                  <span className="font-medium">Aceitar chamados pelo formulário público</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Desmarcado, ninguém de fora abre chamado nesta empresa — nem com um domínio
                    cadastrado abaixo.
                  </span>
                </span>
              </label>

              {!editing ? (
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  Salve a empresa primeiro. Os domínios precisam de uma empresa já criada para se
                  vincular.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[0.7rem] text-muted-foreground">
                    Domínios de e-mail desta empresa
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Quem abre chamado pelo formulário público informa o e-mail, e o domínio dele
                    decide a empresa. Domínio não cadastrado aqui não consegue abrir chamado. Cada
                    domínio pertence a uma empresa só.
                  </p>

                  <div className="flex gap-2">
                    <Input
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newDomain.trim()) addDomain.mutate();
                        }
                      }}
                      placeholder="empresa.com.br"
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={!newDomain.trim() || addDomain.isPending}
                      onClick={() => addDomain.mutate()}
                    >
                      <Plus className="size-3.5" /> Adicionar
                    </Button>
                  </div>

                  {domainsQuery.isLoading && (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  )}

                  {domainsQuery.data?.length === 0 && !domainsQuery.isLoading && (
                    <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                      Nenhum domínio cadastrado. Enquanto estiver assim, o formulário público não
                      aceita chamado para esta empresa.
                    </p>
                  )}

                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {(domainsQuery.data ?? []).map((d) => (
                      <li key={d.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="flex-1 truncate font-mono text-xs">{d.domain}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Remover ${d.domain}`}
                          disabled={removeDomain.isPending}
                          onClick={() => removeDomain.mutate(d.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

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
                    <SelectItem value={ROOT}>Nenhuma (empresa principal)</SelectItem>
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
