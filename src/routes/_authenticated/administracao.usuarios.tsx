import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  type AccessProfileRow,
  type EntityRow,
  type GroupMemberRow,
  type UserAuthorizationRow,
  type UserGroupRow,
} from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import {
  createSystemUser,
  deleteSystemUser,
  updateSystemUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/administracao/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários" },
      {
        name: "description",
        content: "Usuários, suas autorizações por entidade e os grupos a que pertencem.",
      },
    ],
  }),
  component: Usuarios,
});

type Person = { id: string; full_name: string; email: string };

function Usuarios() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [newAuth, setNewAuth] = useState({ profile_id: "", entity_id: "", is_recursive: true });
  const [createOpen, setCreateOpen] = useState(false);
  const emptyNewUser = {
    full_name: "",
    email: "",
    password: "",
    profile_id: "",
    entity_id: "",
  };
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [account, setAccount] = useState({ full_name: "", email: "", password: "" });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .order("full_name");
      if (error) throw error;
      return data as Person[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["access_profiles"],
    queryFn: async () => {
      const { data, error } = await db.from("access_profiles").select("*").order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as AccessProfileRow[];
    },
  });

  const entitiesQuery = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await db.from("entities").select("*").order("path");
      if (error) throw new Error(error.message);
      return (data ?? []) as EntityRow[];
    },
  });

  const authQuery = useQuery({
    queryKey: ["user_authorizations"],
    queryFn: async () => {
      const { data, error } = await db.from("user_authorizations").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as UserAuthorizationRow[];
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

  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);
  const accessProfiles = profilesQuery.data ?? [];
  const entities = entitiesQuery.data ?? [];
  const authorizations = authQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  const profileName = (id: string) => accessProfiles.find((p) => p.id === id)?.name ?? "—";
  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) =>
      `${p.full_name} ${p.email}`.toLowerCase().includes(needle),
    );
  }, [people, term]);

  const addAuth = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Escolha um usuário.");
      if (!newAuth.profile_id || !newAuth.entity_id) throw new Error("Escolha o perfil e a entidade.");
      const { error } = await db.from("user_authorizations").insert({
        user_id: selected.id,
        profile_id: newAuth.profile_id,
        entity_id: newAuth.entity_id,
        is_recursive: newAuth.is_recursive,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Autorização concedida.");
      setNewAuth({ profile_id: "", entity_id: "", is_recursive: true });
      queryClient.invalidateQueries({ queryKey: ["user_authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível conceder", {
        description: e.message.includes("duplicate")
          ? "O usuário já tem esse perfil nessa entidade."
          : e.message,
      }),
  });

  const removeAuth = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("user_authorizations").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const toggleGroup = useMutation({
    mutationFn: async (input: { groupId: string; member: GroupMemberRow | undefined }) => {
      if (!selected) return;
      const { error } = input.member
        ? await db.from("group_members").delete().eq("id", input.member.id)
        : await db.from("group_members").insert({ group_id: input.groupId, user_id: selected.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group_members"] }),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: newUser.full_name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        is_recursive: true,
        ...(newUser.profile_id && newUser.entity_id
          ? { profile_id: newUser.profile_id, entity_id: newUser.entity_id }
          : {}),
      };
      return await createSystemUser({ data: payload });
    },
    onSuccess: () => {
      toast.success("Usuário criado.", { description: "Ele já pode entrar com a senha definida." });
      setCreateOpen(false);
      setNewUser(emptyNewUser);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (e: Error) => toast.error("Não foi possível criar", { description: e.message }),
  });

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await updateSystemUser({
        data: {
          user_id: selected.id,
          ...(account.full_name.trim() && account.full_name.trim() !== selected.full_name
            ? { full_name: account.full_name.trim() }
            : {}),
          ...(account.email.trim() && account.email.trim() !== selected.email
            ? { email: account.email.trim() }
            : {}),
          ...(account.password ? { password: account.password } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Conta atualizada.");
      setAccount((a) => ({ ...a, password: "" }));
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      await deleteSystemUser({ data: { user_id: id } });
    },
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_authorizations"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const selectedAuths = authorizations.filter((a) => a.user_id === selected?.id);
  const withoutAuth = people.filter(
    (p) => !authorizations.some((a) => a.user_id === p.id),
  ).length;
  const initialsOf = (p: Person) =>
    (p.full_name || p.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");

  return (
    <AppShell
      title="Usuários"
      subtitle="Quem acessa o sistema, com qual perfil e em qual entidade."
      breadcrumbTail="Usuários"
      actions={
        can("user", "create") ? (
          <Button
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => {
              setNewUser({ ...emptyNewUser, entity_id: entities[0]?.id ?? "" });
              setCreateOpen(true);
            }}
          >
            <UserPlus className="size-4" /> Novo usuário
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Usuários", value: people.length, icon: Users },
          { label: "Autorizações", value: authorizations.length, icon: ShieldCheck },
          { label: "Sem autorização", value: withoutAuth, icon: UserCog },
        ].map((tile, index) => (
          <div
            key={tile.label}
            className="tile rise-in flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <tile.icon className="size-5" />
            </span>
            <span>
              <span className="block text-xl font-semibold leading-none">{tile.value}</span>
              <span className="text-[0.72rem] text-muted-foreground">{tile.label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="panel mb-3 p-2">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="h-9 rounded-xl pl-8 text-xs"
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfis</th>
                <th>Grupos</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {peopleQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Carregando usuários...
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const auths = authorizations.filter((a) => a.user_id === p.id);
                const userGroups = members
                  .filter((m) => m.user_id === p.id)
                  .map((m) => groups.find((g) => g.id === m.group_id)?.name)
                  .filter(Boolean);
                return (
                  <tr key={p.id}>
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#8b5cf6] text-[0.68rem] font-semibold text-white">
                          {initialsOf(p)}
                        </span>
                        {p.full_name || "—"}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{p.email}</td>
                    <td>
                      {auths.length === 0 ? (
                        <span className="text-muted-foreground">Sem autorização</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {auths.map((a) => (
                            <span
                              key={a.id}
                              className="rounded-sm border border-border bg-secondary px-1.5 text-[0.68rem]"
                            >
                              {profileName(a.profile_id)} · {entityName(a.entity_id)}
                              {a.is_recursive ? " +" : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground">
                      {userGroups.length > 0 ? userGroups.join(", ") : "—"}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {can("user", "update") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelected(p);
                              setAccount({
                                full_name: p.full_name ?? "",
                                email: p.email ?? "",
                                password: "",
                              });
                              setNewAuth({
                                profile_id: "",
                                entity_id: entities[0]?.id ?? "",
                                is_recursive: true,
                              });
                            }}
                          >
                            <UserCog className="size-3.5" /> Gerenciar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.full_name || selected?.email}</DialogTitle>
            <DialogDescription className="text-xs">{selected?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {can("user", "update") && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <UserCog className="size-3.5" /> Dados da conta
                </h3>
                <div className="panel grid gap-2 p-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Nome</Label>
                    <Input
                      value={account.full_name}
                      onChange={(e) => setAccount({ ...account, full_name: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">E-mail</Label>
                    <Input
                      value={account.email}
                      onChange={(e) => setAccount({ ...account, email: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Nova senha</Label>
                    <Input
                      type="password"
                      value={account.password}
                      placeholder="Deixe em branco para manter"
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 flex flex-wrap justify-end gap-2">
                    {can("user", "delete") && selected && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-destructive"
                        onClick={() => {
                          if (confirm("Excluir este usuário em definitivo?")) {
                            removeUser.mutate(selected.id);
                          }
                        }}
                        disabled={removeUser.isPending}
                      >
                        <Trash2 className="size-3.5" /> Excluir usuário
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => saveAccount.mutate()}
                      disabled={saveAccount.isPending}
                    >
                      {saveAccount.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <KeyRound className="size-3.5" />
                      )}
                      Salvar conta
                    </Button>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <ShieldCheck className="size-3.5" /> Autorizações
              </h3>
              <div className="panel overflow-hidden">
                <table className="glpi-table">
                  <thead>
                    <tr>
                      <th>Perfil</th>
                      <th>Entidade</th>
                      <th>Recursivo</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAuths.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          Nenhuma autorização. Sem uma, o usuário não enxerga nada.
                        </td>
                      </tr>
                    )}
                    {selectedAuths.map((a) => (
                      <tr key={a.id}>
                        <td className="font-medium">{profileName(a.profile_id)}</td>
                        <td>{entityName(a.entity_id)}</td>
                        <td>{a.is_recursive ? "Sim" : "Não"}</td>
                        <td>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Remover autorização"
                            onClick={() => removeAuth.mutate(a.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-[0.7rem] text-muted-foreground">Perfil</Label>
                  <Select
                    value={newAuth.profile_id}
                    onValueChange={(v) => setNewAuth({ ...newAuth, profile_id: v })}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.7rem] text-muted-foreground">Entidade</Label>
                  <Select
                    value={newAuth.entity_id}
                    onValueChange={(v) => setNewAuth({ ...newAuth, entity_id: v })}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
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
                <label className="flex h-8 items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={newAuth.is_recursive}
                    onCheckedChange={(v) => setNewAuth({ ...newAuth, is_recursive: v === true })}
                  />
                  Recursivo
                </label>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => addAuth.mutate()}
                  disabled={addAuth.isPending}
                >
                  <Plus className="size-3.5" /> Conceder
                </Button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold">Grupos</h3>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo cadastrado ainda.</p>
              ) : (
                <div className="panel grid gap-1 p-2 sm:grid-cols-2">
                  {groups.map((g) => {
                    const member = members.find(
                      (m) => m.group_id === g.id && m.user_id === selected?.id,
                    );
                    return (
                      <label key={g.id} className="flex items-center gap-2 px-1 py-1 text-xs">
                        <Checkbox
                          checked={Boolean(member)}
                          disabled={!can("group", "update")}
                          onCheckedChange={() => toggleGroup.mutate({ groupId: g.id, member })}
                        />
                        {g.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setSelected(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription className="text-xs">
              A conta é criada já confirmada — o usuário entra com o e-mail e a senha definidos aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome completo</Label>
              <Input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Ex.: Maria Souza"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="usuario@empresa.com.br"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Mínimo de 8 caracteres"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Perfil</Label>
                <Select
                  value={newUser.profile_id}
                  onValueChange={(v) => setNewUser({ ...newUser, profile_id: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entidade</Label>
                <Select
                  value={newUser.entity_id}
                  onValueChange={(v) => setNewUser({ ...newUser, entity_id: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
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
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              {createUser.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
