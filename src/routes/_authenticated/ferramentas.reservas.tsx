import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/ferramentas/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas — Helpdesk T.I." },
      {
        name: "description",
        content: "Reserva de equipamento: projetor, notebook de empréstimo, sala.",
      },
    ],
  }),
  component: Reservas,
});

/** Repetições aceitas ao criar uma reserva, como no GLPI. */
const REPEATS = [
  { value: "0", label: "Sem repetição" },
  { value: "1", label: "Diária, por 5 dias" },
  { value: "7", label: "Semanal, por 4 semanas" },
];

function Reservas() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canWrite = can("reservation", "update");
  const canReserve = can("reservation", "create");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [form, setForm] = useState({ begin_at: "", end_at: "", comment: "", repeat: "0" });

  const assetsQuery = useQuery({
    queryKey: ["assets_options"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id,name,asset_tag").order("name");
      return data ?? [];
    },
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("reservations")
        .select("*")
        .eq("reservation_item_id", String(selected?.id))
        .order("begin_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email");
      return data ?? [];
    },
  });

  const reserve = useMutation({
    mutationFn: async () => {
      if (!form.begin_at || !form.end_at) throw new Error("Informe início e fim.");
      const { data: userData } = await supabase.auth.getUser();
      const repeatDays = Number(form.repeat);
      const occurrences = repeatDays === 1 ? 5 : repeatDays === 7 ? 4 : 1;
      const group = repeatDays > 0 ? crypto.randomUUID() : null;

      for (let i = 0; i < occurrences; i++) {
        const begin = new Date(form.begin_at);
        const end = new Date(form.end_at);
        begin.setDate(begin.getDate() + i * repeatDays);
        end.setDate(end.getDate() + i * repeatDays);

        const { error } = await looseDb.from("reservations").insert({
          reservation_item_id: selected?.id,
          user_id: userData.user?.id ?? null,
          begin_at: begin.toISOString(),
          end_at: end.toISOString(),
          comment: form.comment,
          repeat_group: group,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Reserva registrada.");
      setForm({ begin_at: "", end_at: "", comment: "", repeat: "0" });
      queryClient.invalidateQueries({ queryKey: ["reservations", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível reservar", { description: e.message }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("reservations").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reservations", selected?.id] }),
    onError: (e: Error) => toast.error("Não foi possível cancelar", { description: e.message }),
  });

  const assetOptions = (assetsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const assetName = (id: unknown) =>
    (assetsQuery.data ?? []).find((a) => a.id === String(id))?.name ?? "Equipamento";
  const personName = (id: unknown) => {
    const found = (peopleQuery.data ?? []).find((p) => p.id === String(id));
    return found ? found.full_name || found.email : "—";
  };

  return (
    <AppShell
      title="Reservas"
      subtitle="Só o que estiver liberado aqui pode ser reservado — como no GLPI."
      breadcrumbTail="Reservas"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_400px]">
        <div>
          <CrudTable
            table="reservation_items"
            queryKey="reservation_items"
            orderBy="created_at"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            emptyText="Nenhum equipamento liberado para reserva."
            defaults={{ asset_id: "", is_active: true, comment: "" }}
            fields={[
              {
                key: "asset_id",
                label: "Equipamento",
                type: "select",
                options: assetOptions,
                required: true,
                render: (row) => assetName(row["asset_id"]),
              },
              { key: "is_active", label: "Liberado", type: "boolean" },
              { key: "comment", label: "Observação", type: "text" },
            ]}
          />
        </div>

        <div>
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              <CalendarClock className="mx-auto mb-2 size-5 opacity-60" />
              Escolha um equipamento para ver a agenda.
            </section>
          ) : (
            <section className="panel overflow-hidden">
              <header className="panel-header">Agenda de {assetName(selected["asset_id"])}</header>
              <ul className="divide-y divide-border">
                {(reservationsQuery.data ?? []).length === 0 && (
                  <li className="px-3 py-4 text-xs text-muted-foreground">
                    Nenhuma reserva. O equipamento está livre.
                  </li>
                )}
                {(reservationsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex-1">
                        {formatDate(String(r["begin_at"]))} até {formatDate(String(r["end_at"]))}
                      </span>
                      {canReserve && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Cancelar reserva"
                          onClick={() => cancel.mutate(r.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {personName(r["user_id"])}
                      {String(r["comment"] ?? "") ? ` · ${String(r["comment"])}` : ""}
                    </p>
                  </li>
                ))}
              </ul>

              {canReserve && (
                <div className="space-y-2 border-t border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Início</Label>
                      <Input
                        type="datetime-local"
                        value={form.begin_at}
                        onChange={(e) => setForm({ ...form, begin_at: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[0.7rem] text-muted-foreground">Fim</Label>
                      <Input
                        type="datetime-local"
                        value={form.end_at}
                        onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.7rem] text-muted-foreground">Repetição</Label>
                    <select
                      value={form.repeat}
                      onChange={(e) => setForm({ ...form, repeat: e.target.value })}
                      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    >
                      {REPEATS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder="Para quê?"
                    className="h-8 text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => reserve.mutate()}
                      disabled={reserve.isPending}
                    >
                      <Plus className="size-3.5" /> Reservar
                    </Button>
                  </div>
                  <p className="text-[0.68rem] text-muted-foreground">
                    O banco recusa duas reservas do mesmo equipamento no mesmo horário.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
