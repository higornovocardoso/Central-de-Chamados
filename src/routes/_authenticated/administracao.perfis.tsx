import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  db,
  type AccessProfileRow,
  type FlagDefinitionRow,
  type ProfileFlagRow,
  type ProfileLifecycleRow,
  type ProfileRightRow,
  type RightDefinitionRow,
} from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { RIGHT_ACTIONS, RIGHT_CATEGORIES, rightTab, type RightAction } from "@/lib/permissions";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/administracao/perfis")({
  head: () => ({
    meta: [
      { title: "Perfis" },
      {
        name: "description",
        content: "Perfis de acesso e a matriz de direitos por objeto, no modelo do GLPI.",
      },
    ],
  }),
  component: Perfis,
});

/** Só as colunas booleanas da matriz — as que a caixa de seleção altera. */
type BooleanRightColumn = "can_read" | "can_update" | "can_create" | "can_delete" | "can_purge";

const ACTION_COLUMN: Record<RightAction, BooleanRightColumn> = {
  read: "can_read",
  update: "can_update",
  create: "can_create",
  delete: "can_delete",
  purge: "can_purge",
};

function Perfis() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const editable = can("profile", "update");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccessProfileRow | null>(null);
  const [form, setForm] = useState({ name: "", interface: "standard", comment: "" });

  const profilesQuery = useQuery({
    queryKey: ["access_profiles"],
    queryFn: async () => {
      const { data, error } = await db.from("access_profiles").select("*").order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as AccessProfileRow[];
    },
  });

  const definitionsQuery = useQuery({
    queryKey: ["right_definitions"],
    queryFn: async () => {
      const [rights, flags] = await Promise.all([
        db.from("right_definitions").select("*").order("sort"),
        db.from("flag_definitions").select("*").order("sort"),
      ]);
      if (rights.error) throw new Error(rights.error.message);
      return {
        rights: (rights.data ?? []) as RightDefinitionRow[],
        flags: (flags.data ?? []) as FlagDefinitionRow[],
      };
    },
  });

  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);

  useEffect(() => {
    if (!selectedId && profiles.length > 0) setSelectedId(profiles[0]?.id ?? null);
  }, [profiles, selectedId]);

  const detailQuery = useQuery({
    queryKey: ["profile_detail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const [rights, flags, lifecycle] = await Promise.all([
        db.from("profile_rights").select("*").eq("profile_id", selectedId!),
        db.from("profile_flags").select("*").eq("profile_id", selectedId!),
        db.from("profile_lifecycle").select("*").eq("profile_id", selectedId!),
      ]);
      if (rights.error) throw new Error(rights.error.message);
      return {
        rights: (rights.data ?? []) as ProfileRightRow[],
        flags: (flags.data ?? []) as ProfileFlagRow[],
        lifecycle: (lifecycle.data ?? []) as ProfileLifecycleRow[],
      };
    },
  });

  const rightsByObject = useMemo(() => {
    const map = new Map<string, ProfileRightRow>();
    for (const r of detailQuery.data?.rights ?? []) map.set(r.object_key, r);
    return map;
  }, [detailQuery.data]);

  const flagsByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const f of detailQuery.data?.flags ?? []) map.set(f.flag_key, f.enabled);
    return map;
  }, [detailQuery.data]);

  const lifecycleByPair = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of detailQuery.data?.lifecycle ?? []) {
      map.set(`${l.from_status}>${l.to_status}`, l.allowed);
    }
    return map;
  }, [detailQuery.data]);

  const invalidateDetail = () =>
    queryClient.invalidateQueries({ queryKey: ["profile_detail", selectedId] });

  const setRight = useMutation({
    mutationFn: async (input: { objectKey: string; action: RightAction; value: boolean }) => {
      if (!selectedId) return;
      const current = rightsByObject.get(input.objectKey);
      const payload = {
        profile_id: selectedId,
        object_key: input.objectKey,
        can_read: current?.can_read ?? false,
        can_update: current?.can_update ?? false,
        can_create: current?.can_create ?? false,
        can_delete: current?.can_delete ?? false,
        can_purge: current?.can_purge ?? false,
        can_read_notes: current?.can_read_notes ?? false,
        can_update_notes: current?.can_update_notes ?? false,
      };
      payload[ACTION_COLUMN[input.action]] = input.value;
      const { error } = await db
        .from("profile_rights")
        .upsert(payload, { onConflict: "profile_id,object_key" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateDetail();
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível alterar o direito", { description: e.message }),
  });

  const setFlag = useMutation({
    mutationFn: async (input: { flagKey: string; value: boolean }) => {
      if (!selectedId) return;
      const { error } = await db
        .from("profile_flags")
        .upsert(
          { profile_id: selectedId, flag_key: input.flagKey, enabled: input.value },
          { onConflict: "profile_id,flag_key" },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateDetail();
      queryClient.invalidateQueries({ queryKey: ["my_permissions"] });
    },
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const setLifecycle = useMutation({
    mutationFn: async (input: { from: string; to: string; value: boolean }) => {
      if (!selectedId) return;
      const { error } = await db.from("profile_lifecycle").upsert(
        {
          profile_id: selectedId,
          object_type: "ticket",
          from_status: input.from,
          to_status: input.to,
          allowed: input.value,
        },
        { onConflict: "profile_id,object_type,from_status,to_status" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidateDetail,
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do perfil.");
      const payload = {
        name: form.name.trim(),
        interface: form.interface as "standard" | "simplified",
        comment: form.comment,
      };
      const { error } = editing
        ? await db.from("access_profiles").update(payload).eq("id", editing.id)
        : await db.from("access_profiles").insert({ ...payload, sort: 900 });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(editing ? "Perfil atualizado." : "Perfil criado.");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["access_profiles"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const removeProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("access_profiles").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Perfil excluído.");
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["access_profiles"] });
    },
    onError: (e: Error) =>
      toast.error("Não foi possível excluir", {
        description: e.message.includes("violates foreign key")
          ? "Há usuários autorizados com este perfil."
          : e.message,
      }),
  });

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const definitions = definitionsQuery.data?.rights ?? [];
  const flagDefinitions = definitionsQuery.data?.flags ?? [];

  return (
    <AppShell
      title="Perfis"
      subtitle="Cada perfil define o que o usuário enxerga e pode fazer, objeto por objeto."
      breadcrumbTail="Perfis"
      actions={
        can("profile", "create") ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              setEditing(null);
              setForm({ name: "", interface: "standard", comment: "" });
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null
      }
    >
      {profilesQuery.isError && (
        <div className="panel p-6 text-center text-xs text-muted-foreground">
          A tabela de perfis ainda não existe no banco. Aplique a migration da fase 2.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        {/* Lista de perfis */}
        <section className="panel h-fit overflow-hidden">
          <header className="panel-header">Perfis</header>
          <ul className="divide-y divide-border">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    p.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                >
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  {p.is_system && <Lock className="size-3 text-muted-foreground" />}
                </button>
              </li>
            ))}
            {profilesQuery.isLoading && (
              <li className="px-3 py-4 text-xs text-muted-foreground">Carregando...</li>
            )}
          </ul>
        </section>

        {/* Detalhe do perfil */}
        {selected ? (
          <section className="space-y-3">
            <div className="panel flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <h2 className="text-sm font-semibold">{selected.name}</h2>
                <p className="text-[0.72rem] text-muted-foreground">
                  Interface {selected.interface === "simplified" ? "simplificada" : "padrão"}
                  {selected.is_default ? " · perfil padrão dos novos usuários" : ""}
                  {selected.comment ? ` · ${selected.comment}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {can("profile", "update") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setEditing(selected);
                      setForm({
                        name: selected.name,
                        interface: selected.interface,
                        comment: selected.comment,
                      });
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                )}
                {can("profile", "delete") && !selected.is_system && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => removeProfile.mutate(selected.id)}
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </Button>
                )}
              </div>
            </div>

            <Tabs defaultValue="assistencia">
              <TabsList className="min-h-8">
                {RIGHT_CATEGORIES.map((c) => (
                  <TabsTrigger key={c.key} value={c.key} className="text-xs">
                    {c.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="flags" className="text-xs">
                  Assistência avançada
                </TabsTrigger>
                <TabsTrigger value="lifecycle" className="text-xs">
                  Ciclo de vida
                </TabsTrigger>
              </TabsList>

              {RIGHT_CATEGORIES.map((category) => (
                <TabsContent key={category.key} value={category.key} className="mt-3">
                  <div className="panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="glpi-table">
                        <thead>
                          <tr>
                            <th>Objeto</th>
                            {RIGHT_ACTIONS.map((a) => (
                              <th key={a.key} className="w-24 text-center" title={a.hint}>
                                {a.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {definitions
                            .filter((d) => rightTab(d) === category.key)
                            .map((d) => {
                              const row = rightsByObject.get(d.key);
                              return (
                                <tr key={d.key}>
                                  <td className="font-medium">{d.label}</td>
                                  {RIGHT_ACTIONS.map((a) => (
                                    <td key={a.key} className="text-center">
                                      <Checkbox
                                        checked={Boolean(row?.[ACTION_COLUMN[a.key]])}
                                        disabled={!editable || setRight.isPending}
                                        onCheckedChange={(v) =>
                                          setRight.mutate({
                                            objectKey: d.key,
                                            action: a.key,
                                            value: v === true,
                                          })
                                        }
                                        aria-label={`${a.label} ${d.label}`}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    Nada é deduzido: para alterar um objeto, a leitura precisa estar marcada também.
                  </p>
                </TabsContent>
              ))}

              <TabsContent value="flags" className="mt-3">
                <div className="panel overflow-hidden">
                  <ul className="divide-y divide-border">
                    {flagDefinitions.map((f) => (
                      <li key={f.key} className="flex items-center gap-3 px-3 py-2">
                        <Checkbox
                          checked={flagsByKey.get(f.key) === true}
                          disabled={!editable || setFlag.isPending}
                          onCheckedChange={(v) =>
                            setFlag.mutate({ flagKey: f.key, value: v === true })
                          }
                          aria-label={f.label}
                        />
                        <span className="text-xs">{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="lifecycle" className="mt-3">
                <div className="panel overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="glpi-table">
                      <thead>
                        <tr>
                          <th>De \ Para</th>
                          {STATUS_ORDER.map((s) => (
                            <th key={s} className="text-center">
                              {STATUS_LABEL[s]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {STATUS_ORDER.map((from) => (
                          <tr key={from}>
                            <td className="font-medium">{STATUS_LABEL[from]}</td>
                            {STATUS_ORDER.map((to) => (
                              <td key={to} className="text-center">
                                {from === to ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <Checkbox
                                    checked={lifecycleByPair.get(`${from}>${to}`) === true}
                                    disabled={!editable || setLifecycle.isPending}
                                    onCheckedChange={(v) =>
                                      setLifecycle.mutate({ from, to, value: v === true })
                                    }
                                    aria-label={`${STATUS_LABEL[from]} para ${STATUS_LABEL[to]}`}
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  Um status desmarcado não aparece na lista de status do chamado para este perfil.
                </p>
              </TabsContent>
            </Tabs>
          </section>
        ) : (
          <section className="panel p-10 text-center text-xs text-muted-foreground">
            Selecione um perfil à esquerda.
          </section>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar perfil" : "Novo perfil"}</DialogTitle>
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
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Interface</Label>
              <Select
                value={form.interface}
                onValueChange={(v) => setForm({ ...form, interface: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Padrão</SelectItem>
                  <SelectItem value="simplified">Simplificada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[0.7rem] text-muted-foreground">Comentário</Label>
              <Textarea
                rows={3}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
