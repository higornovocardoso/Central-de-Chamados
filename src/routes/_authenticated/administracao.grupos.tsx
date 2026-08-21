import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { supabase } from "@/integrations/supabase/client";
import {
  db,
  type EntityRow,
  type GroupMemberRow,
  type UserGroupRow,
} from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/administracao/grupos")({
  head: () => ({
    meta: [
      { title: "Grupos" },
      {
        name: "description",
        content: "Grupos de competência e organizacionais, com seus membros e características.",
      },
    ],
  }),
  component: Grupos,
});

const NONE = "__none__";

const EMPTY = {
  name: "",
  parent_id: NONE,
  entity_id: "",
  is_recursive: false,
  visible_in_ticket: true,
  can_be_notified: true,
  can_be_manager: false,
  contains_assets: false,
  contains_users: true,
  comment: "",
};

const CHARACTERISTICS = [
  { key: "visible_in_ticket", label: "Visível no chamado (grupo requerente ou atribuído)" },
  { key: "can_be_notified", label: "Pode ser notificado" },
  { key: "can_be_manager", label: "Pode ser gerente de projeto" },
  { key: "contains_assets", label: "Pode conter ativos" },
  { key: "contains_users", label: "Pode conter usuários" },
] as const;

function Grupos() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserGroupRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newMember, setNewMember] = useState("");

  const entitiesQuery = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await db.from("entities").select("*").order("path");
      if (error) throw new Error(error.message);
      return (data ?? []) as EntityRow[];
    },
  });

  const groupsQuery = useQuery({
    queryKey: ["user_groups"],
    queryFn: async () => {
      const { data, error } = await db.from("user_groups").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as UserGroupRow[];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["group_members"],
    queryFn: async () => {
      const { data, error } = await db.from("group_members").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as GroupMemberRow[];
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const entities = entitiesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of people) map.set(p.id, p.full_name || p.email);
    return map;
  }, [people]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const groupMembers = members.filter((m) => m.group_id === selectedGroup);
  const current = groups.find((g) => g.id === selectedGroup) ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do grupo.");
      const entityId = form.entity_id || entities[0]?.id;
      if (!entityId) throw new Error("Cadastre uma entidade antes de criar grupos.");
      const payload = {
        name: form.name.trim(),
        parent_id: form.parent_id === NONE ? null : form.parent_id,
        entity_id: entityId,
        is_recursive: form.is_recursive,
        visible_in_ticket: form.visible_in_ticket,
        can_be_notified: form.can_be_notified,
        can_be_manager: form.can_be_manager,
        contains_assets: form.contains_assets,
        contains_users: form.contains_users,
        comment: form.comment,
      };
      const { error } = editing
        ? await db.from("user_groups").update(payload).eq("id", editing.id)
        : await db.from("user_groups").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editing ? "Grupo atualizado." : "Grupo criado.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["user_groups"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("user_groups").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Grupo excluído.");
      setSelectedGroup(null);
      queryClient.invalidateQueries({ queryKey: ["user_groups"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || !newMember) throw new Error("Escolha um usuário.");
      const { error } = await db
        .from("group_members")
        .insert({ group_id: selectedGroup, user_id: newMember });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewMember("");
      queryClient.invalidateQueries({ queryKey: ["group_members"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível adicionar", {
        description: e.message.includes("duplicate") ? "Esse usuário já está no grupo." : e.message,
      }),
  });

  const updateMember = useMutation({
    mutationFn: async (input: { id: string; field: "is_manager" | "is_delegate"; value: boolean }) => {
      const patch =
        input.field === "is_manager"
          ? { is_manager: input.value }
          : { is_delegate: input.value };
      const { error } = await db.from("group_members").update(patch).eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group_members"] }),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("group_members").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group_members"] }),
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, entity_id: entities[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(group: UserGroupRow) {
    setEditing(group);
    setForm({
      name: group.name,
      parent_id: group.parent_id ?? NONE,
      entity_id: group.entity_id,
      is_recursive: group.is_recursive,
      visible_in_ticket: group.visible_in_ticket,
      can_be_notified: group.can_be_notified,
      can_be_manager: group.can_be_manager,
      contains_assets: group.contains_assets,
      contains_users: group.contains_users,
      comment: group.comment,
    });
    setOpen(true);
  }

  return (
    <AppShell
      title="Grupos"
      subtitle="Grupos de competência (técnicos de rede, financeiro) e grupos organizacionais."
      breadcrumbTail="Grupos"
      actions={
        can("group", "create") ? (
          <Button size="sm" className="h-8" onClick={openNew}>
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null
      }
    >
      {groupsQuery.isError && (
        <div className="panel mb-3 p-6 text-center text-xs text-muted-foreground">
          A tabela de grupos ainda não existe no banco. Aplique a migration da fase 2.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <section className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="glpi-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Entidade</th>
                  <th>Membros</th>
                  <th>Características</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && !groupsQuery.isLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Nenhum grupo cadastrado.
                    </td>
                  </tr>
                )}
                {groups.map((g) => (
                  <tr
                    key={g.id}
                    data-selected={g.id === selectedGroup}
                    className="cursor-pointer"
                    onClick={() => setSelectedGroup(g.id)}
                  >
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Users className="size-3.5 text-muted-foreground" />
                        {g.name}
                      </span>
                    </td>
                    <td>
                      {entityName(g.entity_id)}
                      {g.is_recursive && (
                        <span className="ml-1 text-[0.65rem] text-muted-foreground">(+filhas)</span>
                      )}
                    </td>
                    <td className="tabular-nums">
                      {members.filter((m) => m.group_id === g.id).length}
                    </td>
                    <td className="text-[0.72rem] text-muted-foreground">
                      {[
                        g.visible_in_ticket ? "chamado" : null,
                        g.can_be_notified ? "notificável" : null,
                        g.contains_assets ? "ativos" : null,
                        g.contains_users ? "usuários" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {can("group", "update") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Editar"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEdit(g);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {can("group", "delete") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Excluir"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              remove.mutate(g.id);
                            }}
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
        </section>

        {/* Membros do grupo selecionado */}
        <section className="panel h-fit overflow-hidden">
          <header className="panel-header">
            {current ? `Membros de ${current.name}` : "Membros"}
          </header>
          {!current ? (
            <p className="p-4 text-xs text-muted-foreground">Selecione um grupo na lista.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {groupMembers.length === 0 && (
                  <li className="px-3 py-4 text-xs text-muted-foreground">Nenhum membro ainda.</li>
                )}
                {groupMembers.map((m) => (
                  <li key={m.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {nameById.get(m.user_id) ?? m.user_id.slice(0, 8)}
                      </span>
                      {can("group", "update") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Remover do grupo"
                          onClick={() => removeMember.mutate(m.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-1 flex gap-4 text-[0.7rem] text-muted-foreground">
                      <label className="flex items-center gap-1.5">
                        <Checkbox
                          checked={m.is_manager}
                          disabled={!can("group", "update")}
                          onCheckedChange={(v) =>
                            updateMember.mutate({ id: m.id, field: "is_manager", value: v === true })
                          }
                        />
                        Gerente
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Checkbox
                          checked={m.is_delegate}
                          disabled={!can("group", "update")}
                          onCheckedChange={(v) =>
                            updateMember.mutate({ id: m.id, field: "is_delegate", value: v === true })
                          }
                        />
                        Delegação
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
              {can("group", "update") && (
                <div className="flex gap-2 border-t border-border p-2">
                  <Select value={newMember} onValueChange={setNewMember}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Adicionar usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {people
                        .filter((p) => !groupMembers.some((m) => m.user_id === p.id))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => addMember.mutate()}
                    disabled={!newMember || addMember.isPending}
                  >
                    <UserPlus className="size-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar grupo" : "Novo grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[0.7rem] text-muted-foreground">Entidade</Label>
                <Select
                  value={form.entity_id}
                  onValueChange={(v) => setForm({ ...form, entity_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[0.7rem] text-muted-foreground">Como filho de</Label>
                <Select
                  value={form.parent_id}
                  onValueChange={(v) => setForm({ ...form, parent_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {groups
                      .filter((g) => !editing || g.id !== editing.id)
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={form.is_recursive}
                onCheckedChange={(v) => setForm({ ...form, is_recursive: v === true })}
              />
              Visível também nas entidades filhas
            </label>

            <div className="space-y-1.5 border-t border-border pt-2">
              <Label className="text-[0.7rem] text-muted-foreground">Características</Label>
              {CHARACTERISTICS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={form[c.key]}
                    onCheckedChange={(v) => setForm({ ...form, [c.key]: v === true })}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Comentário</Label>
              <Textarea
                rows={2}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                className="text-xs"
              />
            </div>
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
    </AppShell>
  );
}
