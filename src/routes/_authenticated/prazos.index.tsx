import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { looseDb } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/prazos/")({
  head: () => ({
    meta: [
      { title: "Prazos" },
      {
        name: "description",
        content: "Em quanto tempo responder e resolver cada chamado, conforme a prioridade.",
      },
    ],
  }),
  component: Prazos,
});

/**
 * As cinco prioridades do chamado caem em quatro faixas de prazo (é o que o
 * banco grava em tickets.priority). Da mais urgente para a mais tranquila.
 */
const FAIXAS = [
  { priority: "critica", nome: "Crítica", niveis: "Prioridade muito alta" },
  { priority: "alta", nome: "Alta", niveis: "Prioridade alta" },
  { priority: "media", nome: "Média", niveis: "Prioridade média" },
  { priority: "baixa", nome: "Baixa", niveis: "Prioridades baixa e muito baixa" },
] as const;

/** Sem calendário o prazo corre 24 h por dia; o Select não aceita valor vazio. */
const CORRIDO = "corrido";

type Unidade = "min" | "h";
type Tempo = { valor: string; unidade: Unidade };
type Linha = { id: string; responder: Tempo; resolver: Tempo; calendario: string };

function paraTempo(minutos: number): Tempo {
  return minutos % 60 === 0
    ? { valor: String(minutos / 60), unidade: "h" }
    : { valor: String(minutos), unidade: "min" };
}

function paraMinutos(t: Tempo) {
  const n = Number(t.valor.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(t.unidade === "h" ? n * 60 : n);
}

function Prazos() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canWrite = can("sla", "update");

  const politicas = useQuery({
    queryKey: ["sla_policies"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("sla_policies").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const calendarios = useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("calendars").select("id,name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const original = useMemo(() => {
    const porPrioridade: Record<string, Linha> = {};
    for (const p of politicas.data ?? []) {
      porPrioridade[String(p["priority"])] = {
        id: p.id,
        responder: paraTempo(Number(p["response_minutes"])),
        resolver: paraTempo(Number(p["resolution_minutes"])),
        calendario: p["calendar_id"] ? String(p["calendar_id"]) : CORRIDO,
      };
    }
    return porPrioridade;
  }, [politicas.data]);

  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  useEffect(() => setLinhas(original), [original]);

  const alterado = JSON.stringify(linhas) !== JSON.stringify(original);

  function muda(priority: string, parte: Partial<Linha>) {
    setLinhas((atual) => {
      const linha = atual[priority];
      return linha ? { ...atual, [priority]: { ...linha, ...parte } } : atual;
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      for (const f of FAIXAS) {
        const linha = linhas[f.priority];
        if (!linha) continue;
        const responder = paraMinutos(linha.responder);
        const resolver = paraMinutos(linha.resolver);
        if (responder === null || resolver === null) {
          throw new Error(
            `Preencha os dois tempos da faixa ${f.nome} com números maiores que zero.`,
          );
        }
        if (resolver < responder) {
          throw new Error(`Na faixa ${f.nome}, resolver não pode levar menos tempo que responder.`);
        }
        const { error } = await looseDb
          .from("sla_policies")
          .update({
            response_minutes: responder,
            resolution_minutes: resolver,
            calendar_id: linha.calendario === CORRIDO ? null : linha.calendario,
          })
          .eq("id", linha.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_policies"] });
      toast.success("Prazos salvos");
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  return (
    <AppShell
      title="Prazos"
      subtitle="Em quanto tempo responder e resolver cada chamado, conforme a prioridade."
      breadcrumbTail="Prazos"
    >
      <section className="panel overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
          <span>Faixa</span>
          <span>Responder em</span>
          <span>Resolver em</span>
          <span>Contar o tempo</span>
        </div>

        {politicas.isLoading && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        <ul className="divide-y divide-border">
          {FAIXAS.map((f) => {
            const linha = linhas[f.priority];
            if (!linha) return null;
            return (
              <li
                key={f.priority}
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center md:gap-4"
              >
                <div>
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">{f.niveis}</p>
                </div>
                <CampoTempo
                  rotulo="Responder em"
                  valor={linha.responder}
                  desabilitado={!canWrite}
                  onChange={(responder) => muda(f.priority, { responder })}
                />
                <CampoTempo
                  rotulo="Resolver em"
                  valor={linha.resolver}
                  desabilitado={!canWrite}
                  onChange={(resolver) => muda(f.priority, { resolver })}
                />
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                    Contar o tempo
                  </span>
                  <Select
                    value={linha.calendario}
                    disabled={!canWrite}
                    onValueChange={(calendario) => muda(f.priority, { calendario })}
                  >
                    <SelectTrigger aria-label={`Como contar o tempo da faixa ${f.nome}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(calendarios.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          No expediente de {String(c["name"])}
                        </SelectItem>
                      ))}
                      <SelectItem value={CORRIDO}>Corrido, 24 h por dia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
        </ul>

        {canWrite && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
            {alterado && (
              <Button variant="ghost" onClick={() => setLinhas(original)}>
                Desfazer
              </Button>
            )}
            <Button onClick={() => salvar.mutate()} disabled={!alterado || salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar prazos
            </Button>
          </div>
        )}
      </section>

      <ul className="mt-4 space-y-1.5 text-[0.8125rem] text-muted-foreground">
        <li>
          No expediente, o prazo só corre nos horários do calendário e pula os feriados. O
          expediente e os feriados são definidos na aba Calendários.
        </li>
        <li>
          Quando a urgência ou o impacto mudam a prioridade de um chamado, o prazo dele é refeito.
          Mudar esta tabela vale para os chamados novos e para os que mudarem de prioridade.
        </li>
        <li>
          Chamado em Pendente congela o prazo: ao voltar, o tempo parado é somado ao vencimento.
        </li>
      </ul>
    </AppShell>
  );
}

function CampoTempo({
  rotulo,
  valor,
  desabilitado,
  onChange,
}: {
  rotulo: string;
  valor: Tempo;
  desabilitado: boolean;
  onChange: (t: Tempo) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs text-muted-foreground md:hidden">{rotulo}</span>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          value={valor.valor}
          disabled={desabilitado}
          aria-label={rotulo}
          onChange={(e) => onChange({ ...valor, valor: e.target.value })}
          className="w-20 tabular-nums"
        />
        <Select
          value={valor.unidade}
          disabled={desabilitado}
          onValueChange={(unidade) => onChange({ ...valor, unidade: unidade as Unidade })}
        >
          <SelectTrigger className="w-[6.5rem]" aria-label={`Unidade de ${rotulo.toLowerCase()}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="min">minutos</SelectItem>
            <SelectItem value="h">horas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
