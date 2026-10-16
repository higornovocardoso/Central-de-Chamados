import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";

export const Route = createFileRoute("/_authenticated/prazos/calendarios")({
  head: () => ({
    meta: [
      { title: "Calendários" },
      {
        name: "description",
        content: "Horários de expediente e feriados usados na contagem dos prazos.",
      },
    ],
  }),
  component: Calendarios,
});

const WEEKDAYS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

function Calendarios() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const entities = useEntityOptions();
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const canWrite = can("calendar", "update");

  const segmentsQuery = useQuery({
    queryKey: ["calendar_segments", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("calendar_segments")
        .select("*")
        .eq("calendar_id", String(selected?.id))
        .order("weekday");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const holidaysQuery = useQuery({
    queryKey: ["calendar_holidays", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("calendar_holidays")
        .select("*")
        .eq("calendar_id", String(selected?.id))
        .order("start_date");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [segment, setSegment] = useState({ weekday: "1", begin_time: "08:00", end_time: "18:00" });
  const [holiday, setHoliday] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_recurring: true,
  });

  const addSegment = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("calendar_segments").insert({
        calendar_id: selected?.id,
        weekday: Number(segment.weekday),
        begin_time: segment.begin_time,
        end_time: segment.end_time,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["calendar_segments", selected?.id] }),
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("calendar_segments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["calendar_segments", selected?.id] }),
  });

  const addHoliday = useMutation({
    mutationFn: async () => {
      if (!holiday.name.trim() || !holiday.start_date) throw new Error("Informe nome e data.");
      const { error } = await looseDb.from("calendar_holidays").insert({
        calendar_id: selected?.id,
        name: holiday.name.trim(),
        start_date: holiday.start_date,
        end_date: holiday.end_date || holiday.start_date,
        is_recurring: holiday.is_recurring,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setHoliday({ name: "", start_date: "", end_date: "", is_recurring: true });
      queryClient.invalidateQueries({ queryKey: ["calendar_holidays", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const removeHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("calendar_holidays").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["calendar_holidays", selected?.id] }),
  });

  return (
    <AppShell
      title="Calendários"
      subtitle="O expediente e os feriados que os prazos usam para contar o tempo."
      breadcrumbTail="Calendários"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div>
          <CrudTable
            table="calendars"
            queryKey="calendars"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            emptyText="Nenhum calendário cadastrado."
            defaults={{
              name: "",
              entity_id: entities[0]?.value ?? "",
              is_default: false,
              comment: "",
            }}
            fields={[
              { key: "name", label: "Nome", type: "text", required: true },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "is_default", label: "Padrão", type: "boolean" },
              { key: "comment", label: "Comentário", type: "textarea" },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Sem calendário associado, o SLA conta 24 horas por dia, 7 dias por semana — o mesmo
            comportamento do GLPI.
          </p>
        </div>

        <div className="space-y-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">
              {selected ? `Expediente de ${selected["name"]}` : "Expediente"}
            </header>
            {!selected ? (
              <p className="p-4 text-xs text-muted-foreground">Escolha um calendário na lista.</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {(segmentsQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-4 text-xs text-muted-foreground">
                      Nenhuma faixa de horário. O calendário está sem expediente.
                    </li>
                  )}
                  {(segmentsQuery.data ?? []).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="w-20 font-medium">
                        {WEEKDAYS.find((d) => d.value === String(s["weekday"]))?.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {String(s["begin_time"]).slice(0, 5)} às {String(s["end_time"]).slice(0, 5)}
                      </span>
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto size-6"
                          aria-label="Remover faixa"
                          onClick={() => removeSegment.mutate(s.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {canWrite && (
                  <div className="flex flex-wrap gap-2 border-t border-border p-2">
                    <select
                      value={segment.weekday}
                      onChange={(e) => setSegment({ ...segment, weekday: e.target.value })}
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={segment.begin_time}
                      onChange={(e) => setSegment({ ...segment, begin_time: e.target.value })}
                      className="h-8 w-24 text-xs"
                    />
                    <Input
                      type="time"
                      value={segment.end_time}
                      onChange={(e) => setSegment({ ...segment, end_time: e.target.value })}
                      className="h-8 w-24 text-xs"
                    />
                    <Button size="sm" className="h-8" onClick={() => addSegment.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="panel overflow-hidden">
            <header className="panel-header">Fechamentos e feriados</header>
            {!selected ? (
              <p className="p-4 text-xs text-muted-foreground">Escolha um calendário na lista.</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {(holidaysQuery.data ?? []).length === 0 && (
                    <li className="px-3 py-4 text-xs text-muted-foreground">Nenhum fechamento.</li>
                  )}
                  {(holidaysQuery.data ?? []).map((h) => (
                    <li key={h.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="flex-1 truncate">{String(h["name"])}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {new Date(`${String(h["start_date"])}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                          },
                        )}
                      </span>
                      {h["is_recurring"] === true && (
                        <span className="rounded-sm bg-secondary px-1 text-[0.6rem] uppercase text-muted-foreground">
                          todo ano
                        </span>
                      )}
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Remover fechamento"
                          onClick={() => removeHoliday.mutate(h.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {canWrite && (
                  <div className="space-y-2 border-t border-border p-2">
                    <Input
                      value={holiday.name}
                      onChange={(e) => setHoliday({ ...holiday, name: e.target.value })}
                      placeholder="Nome do feriado"
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={holiday.start_date}
                        onChange={(e) => setHoliday({ ...holiday, start_date: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={holiday.end_date}
                        onChange={(e) => setHoliday({ ...holiday, end_date: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs">
                        <Checkbox
                          checked={holiday.is_recurring}
                          onCheckedChange={(v) =>
                            setHoliday({ ...holiday, is_recurring: v === true })
                          }
                        />
                        Repete todo ano
                      </label>
                      <Button size="sm" className="h-8" onClick={() => addHoliday.mutate()}>
                        <Plus className="size-3.5" /> Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
