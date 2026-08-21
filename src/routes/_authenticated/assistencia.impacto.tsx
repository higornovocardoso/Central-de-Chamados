import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { ticketCode } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/assistencia/impacto")({
  head: () => ({
    meta: [
      { title: "Análise de impacto — Helpdesk T.I." },
      {
        name: "description",
        content: "O que depende do quê: chamados, problemas, mudanças e os ativos envolvidos.",
      },
    ],
  }),
  component: Impacto,
});

const TIPO_LABEL: Record<string, string> = {
  ticket: "Chamado",
  problem: "Problema",
  change: "Mudança",
};

const VINCULO_LABEL: Record<string, string> = {
  ligado: "Ligado a",
  duplicado: "Duplicado de",
  filho: "Filho de",
  pai: "Pai de",
};

function Impacto() {
  const { can } = usePermissions();
  const [origem, setOrigem] = useState("");

  const chamados = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("tickets").select("id,title").order("created_at", {
        ascending: false,
      });
      return data ?? [];
    },
  });

  const relacoes = useQuery({
    queryKey: ["itil_relations"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("itil_relations")
        .select("*")
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const vinculosDeChamado = useQuery({
    queryKey: ["ticket_links_todos"],
    queryFn: async () => {
      const { data } = await looseDb.from("ticket_links").select("*").order("created_at");
      return data ?? [];
    },
  });

  const itensDoChamado = useQuery({
    queryKey: ["ticket_items_todos"],
    queryFn: async () => {
      const { data } = await looseDb.from("ticket_items").select("*").order("created_at");
      return data ?? [];
    },
  });

  const ativos = useQuery({
    queryKey: ["assets_nomes"],
    queryFn: async () => {
      const { data } = await looseDb.from("assets").select("id,name").order("name");
      return data ?? [];
    },
  });

  const opcoes = (chamados.data ?? []).map((t) => ({
    value: t.id,
    label: `${ticketCode(t.id)} — ${t.title}`,
  }));

  const escolhido = origem || opcoes[0]?.value || "";

  const tituloDoChamado = (id: string) =>
    (chamados.data ?? []).find((t) => t.id === id)?.title ?? "Chamado";

  const nomeDoAtivo = (id: unknown) =>
    ((ativos.data ?? []) as LooseRow[]).find((a) => a.id === String(id))?.["name"] ?? "Ativo";

  /** Vínculos entre chamados, nos dois sentidos. */
  const ligados = useMemo(() => {
    const linhas = (vinculosDeChamado.data ?? []) as LooseRow[];
    const saindo = linhas
      .filter((l) => l["ticket_id"] === escolhido)
      .map((l) => ({ id: String(l["linked_ticket_id"]), tipo: String(l["link_type"]) }));
    const entrando = linhas
      .filter((l) => l["linked_ticket_id"] === escolhido)
      .map((l) => ({ id: String(l["ticket_id"]), tipo: String(l["link_type"]) }));
    return [...saindo, ...entrando];
  }, [vinculosDeChamado.data, escolhido]);

  /** Relações com problema e mudança, do modelo genérico da fase 7. */
  const itil = useMemo(() => {
    const linhas = (relacoes.data ?? []) as LooseRow[];
    return linhas.filter(
      (r) =>
        (r["source_type"] === "ticket" && r["source_id"] === escolhido) ||
        (r["target_type"] === "ticket" && r["target_id"] === escolhido),
    );
  }, [relacoes.data, escolhido]);

  const itens = useMemo(
    () => ((itensDoChamado.data ?? []) as LooseRow[]).filter((i) => i["ticket_id"] === escolhido),
    [itensDoChamado.data, escolhido],
  );

  const nada = ligados.length === 0 && itil.length === 0 && itens.length === 0;

  if (!can("ticket", "read")) {
    return (
      <AppShell title="Análise de impacto">
        <div className="panel p-8 text-center text-xs text-muted-foreground">
          Seu perfil não tem acesso aos chamados.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Análise de impacto"
      subtitle="O que está ligado ao quê — para saber o que mais para quando isto parar."
      breadcrumbTail="Análise de impacto"
      actions={
        <div className="flex items-center gap-2">
          <Label className="text-[0.72rem] text-muted-foreground">Partir de</Label>
          <Select value={escolhido} onValueChange={setOrigem}>
            <SelectTrigger className="h-8 w-[280px] text-xs">
              <SelectValue placeholder="Escolha um chamado" />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {opcoes.length === 0 ? (
        <div className="panel p-8 text-center text-xs text-muted-foreground">
          Nenhum chamado cadastrado para analisar.
        </div>
      ) : (
        <div className="space-y-3">
          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{ticketCode(escolhido)}</p>
                <p className="text-xs text-muted-foreground">{tituloDoChamado(escolhido)}</p>
              </div>
            </div>
          </section>

          {nada && (
            <div className="panel p-8 text-center text-xs text-muted-foreground">
              Este chamado não tem vínculo nem ativo associado. As ligações são criadas nas seções
              “Chamados ligados” e “Itens” da própria tela do chamado.
            </div>
          )}

          {ligados.length > 0 && (
            <section className="panel overflow-hidden">
              <header className="panel-header">Chamados ligados ({ligados.length})</header>
              <ul className="divide-y divide-border">
                {ligados.map((l, i) => (
                  <li key={`${l.id}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Tag className="border-border bg-secondary text-muted-foreground">
                      {VINCULO_LABEL[l.tipo] ?? l.tipo}
                    </Tag>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <Link
                      to="/chamados/$id"
                      params={{ id: l.id }}
                      className="truncate text-link hover:underline"
                    >
                      {ticketCode(l.id)} — {tituloDoChamado(l.id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {itil.length > 0 && (
            <section className="panel overflow-hidden">
              <header className="panel-header">Problemas e mudanças ({itil.length})</header>
              <ul className="divide-y divide-border">
                {itil.map((r) => {
                  const ehOrigem = r["source_type"] === "ticket" && r["source_id"] === escolhido;
                  const outroTipo = String(ehOrigem ? r["target_type"] : r["source_type"]);
                  return (
                    <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <Tag className="border-border bg-secondary text-muted-foreground">
                        {TIPO_LABEL[outroTipo] ?? outroTipo}
                      </Tag>
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-[0.7rem]">
                        {String(ehOrigem ? r["target_id"] : r["source_id"]).slice(0, 8).toUpperCase()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {itens.length > 0 && (
            <section className="panel overflow-hidden">
              <header className="panel-header">Ativos envolvidos ({itens.length})</header>
              <ul className="divide-y divide-border">
                {itens.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Link
                      to="/inventario/$id"
                      params={{ id: String(i["asset_id"]) }}
                      className="truncate text-link hover:underline"
                    >
                      {String(nomeDoAtivo(i["asset_id"]))}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        O GLPI desenha isto como um diagrama arrastável. Aqui é uma lista em níveis, que dá a mesma
        resposta — o que cai junto — sem depender de biblioteca de grafo.
      </p>
    </AppShell>
  );
}
