import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { ASSET_KIND_LABEL, ASSET_STATUS_CLASS, ASSET_STATUS_LABEL, formatDay } from "@/lib/glpi";
import type { AssetKind, AssetStatus } from "@/lib/glpi";
import {
  COMPONENT_KIND_LABEL,
  DEPRECIATION_LABEL,
  PORT_TYPES,
  PORT_TYPE_LABEL,
  formatBytes,
  formatMoneyBR,
  tabsFor,
  type ComponentKind,
} from "@/lib/inventory";
import { formatDate, ticketCode } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/inventario/$id")({
  head: () => ({
    meta: [
      { title: "Ativo — Helpdesk T.I." },
      {
        name: "description",
        content: "Ficha do ativo: componentes, rede, softwares, garantia e chamados.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetalheAtivo,
});

const TAB_LABEL: Record<string, string> = {
  componentes: "Componentes",
  volumes: "Volumes",
  sistema: "Sistema operacional",
  softwares: "Softwares",
  conexoes: "Conexões",
  portas: "Portas de rede",
  financeiro: "Gerenciamento",
  cartuchos: "Cartuchos",
  contadores: "Contadores",
  rack: "Itens do rack",
};

function DetalheAtivo() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can("computer", "update");
  const canSeeMoney = can("financial_info", "read");

  const assetQuery = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as (Record<string, unknown> & { id: string }) | null;
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["inventory_catalog"],
    queryFn: async () => {
      const [components, os, assets, locations] = await Promise.all([
        looseDb.from("components").select("*").order("name"),
        looseDb.from("operating_systems").select("*").order("name"),
        supabase.from("assets").select("id,name,kind,asset_tag").order("name"),
        supabase.from("locations").select("id,name").order("name"),
      ]);
      return {
        components: components.data ?? [],
        operatingSystems: os.data ?? [],
        assets: assets.data ?? [],
        locations: locations.data ?? [],
        available: !components.error,
      };
    },
  });

  /** Todas as abas leem o mesmo formato: linhas de uma tabela ligadas ao ativo. */
  const relatedRows = (table: string, column = "asset_id") => async () => {
    const { data, error } = await looseDb.from(table).select("*").eq(column, id).order("id");
    if (error) throw new Error(error.message);
    return (data ?? []) as LooseRow[];
  };

  const componentsQuery = useQuery({
    queryKey: ["asset_components", id],
    queryFn: relatedRows("asset_components"),
  });
  const volumesQuery = useQuery({
    queryKey: ["asset_volumes", id],
    queryFn: relatedRows("asset_volumes"),
  });
  const portsQuery = useQuery({
    queryKey: ["network_ports", id],
    queryFn: relatedRows("network_ports"),
  });
  const osQuery = useQuery({
    queryKey: ["asset_os", id],
    queryFn: relatedRows("asset_operating_systems"),
  });
  const installsQuery = useQuery({
    queryKey: ["software_installations", id],
    queryFn: relatedRows("software_installations"),
  });
  const infocomQuery = useQuery({
    queryKey: ["asset_infocoms", id],
    queryFn: relatedRows("asset_infocoms"),
  });
  const locksQuery = useQuery({
    queryKey: ["field_locks", id],
    queryFn: relatedRows("field_locks", "item_id"),
  });

  const connectionsQuery = useQuery({
    queryKey: ["asset_connections", id],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("asset_connections")
        .select("*")
        .eq("computer_id", id)
        .order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const ticketsQuery = useQuery({
    queryKey: ["asset_tickets", id],
    queryFn: async () => {
      const { data } = await looseDb.from("ticket_items").select("*").eq("asset_id", id).order("id");
      const ids = (data ?? []).map((t) => String(t["ticket_id"]));
      if (ids.length === 0) return [];
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id,title,status,created_at")
        .in("id", ids);
      return tickets ?? [];
    },
  });

  const asset = assetQuery.data;
  const catalog = catalogQuery.data;
  const phase5 = catalog?.available === true;

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key, id] });

  // ---- formulários curtos das abas ---------------------------------------
  const [component, setComponent] = useState({ component_id: "", quantity: 1, serial_number: "" });
  const [volume, setVolume] = useState({ name: "", total_mb: 0, free_mb: 0, filesystem: "NTFS" });
  const [port, setPort] = useState({ name: "", port_type: "ethernet", mac: "" });
  const [connection, setConnection] = useState("");

  const addComponent = useMutation({
    mutationFn: async () => {
      if (!component.component_id) throw new Error("Escolha o componente.");
      const { error } = await looseDb.from("asset_components").insert({
        asset_id: id,
        component_id: component.component_id,
        quantity: Number(component.quantity) || 1,
        serial_number: component.serial_number,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setComponent({ component_id: "", quantity: 1, serial_number: "" });
      invalidate("asset_components");
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const addVolume = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("asset_volumes").insert({ asset_id: id, ...volume });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setVolume({ name: "", total_mb: 0, free_mb: 0, filesystem: "NTFS" });
      invalidate("asset_volumes");
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const addPort = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb.from("network_ports").insert({ asset_id: id, ...port });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPort({ name: "", port_type: "ethernet", mac: "" });
      invalidate("network_ports");
    },
    onError: (e: Error) => toast.error("Não foi possível adicionar", { description: e.message }),
  });

  const addConnection = useMutation({
    mutationFn: async () => {
      const { error } = await looseDb
        .from("asset_connections")
        .insert({ computer_id: id, peripheral_id: connection });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setConnection("");
      invalidate("asset_connections");
    },
    onError: (e: Error) => toast.error("Não foi possível conectar", { description: e.message }),
  });

  const removeFrom = useMutation({
    mutationFn: async (input: { table: string; id: string }) => {
      const { error } = await looseDb.from(input.table).delete().eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate("asset_components");
      invalidate("asset_volumes");
      invalidate("network_ports");
      invalidate("asset_connections");
      invalidate("software_installations");
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const toggleLock = useMutation({
    mutationFn: async (field: string) => {
      const existing = (locksQuery.data ?? []).find((l) => l["field"] === field);
      if (existing) {
        const { error } = await looseDb.from("field_locks").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await looseDb
          .from("field_locks")
          .insert({ item_type: "asset", item_id: id, field });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => invalidate("field_locks"),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  if (assetQuery.isLoading) {
    return (
      <AppShell title="Ativo">
        <p className="text-xs text-muted-foreground">Carregando ativo...</p>
      </AppShell>
    );
  }

  if (!asset) {
    return (
      <AppShell title="Ativo">
        <div className="panel p-10 text-center">
          <p className="text-xs text-muted-foreground">Ativo não encontrado.</p>
          <Link to="/inventario" className="mt-3 inline-block text-xs text-link hover:underline">
            Voltar ao inventário
          </Link>
        </div>
      </AppShell>
    );
  }

  const kind = String(asset["kind"] ?? "outro") as AssetKind;
  const status = String(asset["status"] ?? "em_uso") as AssetStatus;
  const tabs = tabsFor(kind);
  const infocom = (infocomQuery.data ?? [])[0];
  const lockedFields = new Set((locksQuery.data ?? []).map((l) => String(l["field"])));

  const componentName = (componentId: unknown) => {
    const found = (catalog?.components ?? []).find((c) => c.id === String(componentId));
    if (!found) return "Componente";
    return `${COMPONENT_KIND_LABEL[String(found["kind"]) as ComponentKind] ?? ""} — ${String(found["name"])}`;
  };

  const assetName = (assetId: unknown) =>
    (catalog?.assets ?? []).find((a) => a.id === String(assetId))?.name ?? "Ativo";

  return (
    <AppShell breadcrumbTail={String(asset["name"])}>
      <Link
        to="/inventario"
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Voltar ao inventário
      </Link>

      <div className="panel mb-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="border-border bg-secondary text-muted-foreground">
            {ASSET_KIND_LABEL[kind]}
          </Tag>
          <Tag className={ASSET_STATUS_CLASS[status]}>{ASSET_STATUS_LABEL[status]}</Tag>
          {String(asset["asset_tag"] ?? "") && (
            <span className="font-mono text-[0.72rem] text-muted-foreground">
              patrimônio {String(asset["asset_tag"])}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-base font-semibold">{String(asset["name"])}</h1>
        <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
          {[String(asset["brand"] ?? ""), String(asset["model"] ?? "")].filter(Boolean).join(" ") ||
            "Sem marca e modelo"}
          {String(asset["serial_number"] ?? "") ? ` · série ${String(asset["serial_number"])}` : ""}
          {String(asset["assigned_name"] ?? "") ? ` · com ${String(asset["assigned_name"])}` : ""}
        </p>
      </div>

      {!phase5 && (
        <div className="panel mb-3 border-warning/40 p-3 text-xs text-muted-foreground">
          As tabelas da fase 5 ainda não existem no banco. As abas abaixo aparecem vazias.
        </div>
      )}

      <Tabs defaultValue="ativo">
        <TabsList className="min-h-8">
          <TabsTrigger value="ativo" className="text-xs">
            Ativo
          </TabsTrigger>
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs">
              {TAB_LABEL[t] ?? t}
            </TabsTrigger>
          ))}
          <TabsTrigger value="chamados" className="text-xs">
            Chamados ({ticketsQuery.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="bloqueios" className="text-xs">
            Bloqueios
          </TabsTrigger>
        </TabsList>

        {/* Ficha */}
        <TabsContent value="ativo" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <section className="panel">
              <header className="panel-header">Identificação</header>
              <dl className="divide-y divide-border text-xs">
                <Row label="Nome" value={String(asset["name"])} />
                <Row label="Patrimônio" value={String(asset["asset_tag"] ?? "") || "—"} />
                <Row label="Número de série" value={String(asset["serial_number"] ?? "") || "—"} />
                <Row label="Marca" value={String(asset["brand"] ?? "") || "—"} />
                <Row label="Modelo" value={String(asset["model"] ?? "") || "—"} />
                <Row label="Tipo" value={ASSET_KIND_LABEL[kind]} />
                <Row label="Situação" value={ASSET_STATUS_LABEL[status]} />
              </dl>
            </section>
            <section className="panel">
              <header className="panel-header">Uso</header>
              <dl className="divide-y divide-border text-xs">
                <Row label="Responsável" value={String(asset["assigned_name"] ?? "") || "—"} />
                <Row label="Data da compra" value={formatDay(String(asset["purchase_date"] ?? "") || null)} />
                <Row label="Fim da garantia" value={formatDay(String(asset["warranty_end"] ?? "") || null)} />
                <Row label="Origem do dado" value={String(asset["update_source"] ?? "manual")} />
                <Row label="Observações" value={String(asset["notes"] ?? "") || "—"} />
              </dl>
            </section>
          </div>
        </TabsContent>

        {/* Componentes */}
        {tabs.includes("componentes") && (
          <TabsContent value="componentes" className="mt-3">
            <ListPanel
              title="Componentes"
              rows={componentsQuery.data ?? []}
              empty="Nenhum componente registrado."
              render={(c) => (
                <>
                  <span className="flex-1 truncate">{componentName(c["component_id"])}</span>
                  <span className="text-muted-foreground">
                    {String(c["quantity"])}x{" "}
                    {String(c["serial_number"] ?? "") ? `· ${String(c["serial_number"])}` : ""}
                  </span>
                </>
              )}
              onRemove={canEdit ? (rowId) => removeFrom.mutate({ table: "asset_components", id: rowId }) : undefined}
              form={
                canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={component.component_id}
                      onChange={(e) => setComponent({ ...component, component_id: e.target.value })}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Escolha o componente</option>
                      {(catalog?.components ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {componentName(c.id)}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      value={component.quantity}
                      onChange={(e) =>
                        setComponent({ ...component, quantity: Number(e.target.value) })
                      }
                      className="h-8 w-16 text-xs"
                    />
                    <Input
                      value={component.serial_number}
                      onChange={(e) =>
                        setComponent({ ...component, serial_number: e.target.value })
                      }
                      placeholder="Série"
                      className="h-8 w-32 text-xs"
                    />
                    <Button size="sm" className="h-8" onClick={() => addComponent.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : null
              }
            />
          </TabsContent>
        )}

        {/* Volumes */}
        {tabs.includes("volumes") && (
          <TabsContent value="volumes" className="mt-3">
            <ListPanel
              title="Volumes"
              rows={volumesQuery.data ?? []}
              empty="Nenhum volume registrado."
              render={(v) => (
                <>
                  <span className="flex-1 truncate font-medium">{String(v["name"])}</span>
                  <span className="text-muted-foreground">{String(v["filesystem"])}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBytes(Number(v["free_mb"]))} livres de{" "}
                    {formatBytes(Number(v["total_mb"]))}
                  </span>
                </>
              )}
              onRemove={canEdit ? (rowId) => removeFrom.mutate({ table: "asset_volumes", id: rowId }) : undefined}
              form={
                canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={volume.name}
                      onChange={(e) => setVolume({ ...volume, name: e.target.value })}
                      placeholder="C:"
                      className="h-8 w-20 text-xs"
                    />
                    <Input
                      value={volume.filesystem}
                      onChange={(e) => setVolume({ ...volume, filesystem: e.target.value })}
                      placeholder="NTFS"
                      className="h-8 w-24 text-xs"
                    />
                    <Input
                      type="number"
                      value={volume.total_mb}
                      onChange={(e) => setVolume({ ...volume, total_mb: Number(e.target.value) })}
                      placeholder="Total MB"
                      className="h-8 flex-1 text-xs"
                    />
                    <Input
                      type="number"
                      value={volume.free_mb}
                      onChange={(e) => setVolume({ ...volume, free_mb: Number(e.target.value) })}
                      placeholder="Livre MB"
                      className="h-8 flex-1 text-xs"
                    />
                    <Button size="sm" className="h-8" onClick={() => addVolume.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : null
              }
            />
          </TabsContent>
        )}

        {/* Sistema operacional */}
        {tabs.includes("sistema") && (
          <TabsContent value="sistema" className="mt-3">
            <section className="panel">
              <header className="panel-header">Sistema operacional</header>
              {(osQuery.data ?? []).length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  Nenhum sistema operacional registrado.
                </p>
              ) : (
                <dl className="divide-y divide-border text-xs">
                  {(osQuery.data ?? []).map((o) => (
                    <div key={o.id}>
                      <Row
                        label="Sistema"
                        value={
                          (catalog?.operatingSystems ?? []).find((s) => s.id === o["os_id"])?.[
                            "name"
                          ] as string ?? "—"
                        }
                      />
                      <Row label="Versão" value={String(o["version"] ?? "") || "—"} />
                      <Row label="Arquitetura" value={String(o["architecture"] ?? "") || "—"} />
                      <Row label="Kernel" value={String(o["kernel_version"] ?? "") || "—"} />
                      <Row label="Chave" value={String(o["license_number"] ?? "") || "—"} />
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </TabsContent>
        )}

        {/* Softwares instalados */}
        {tabs.includes("softwares") && (
          <TabsContent value="softwares" className="mt-3">
            <ListPanel
              title="Softwares instalados"
              rows={installsQuery.data ?? []}
              empty="Nenhum software instalado registrado."
              render={(s) => (
                <>
                  <span className="flex-1 truncate">Versão {String(s["version_id"]).slice(0, 8)}</span>
                  <span className="text-muted-foreground">
                    {s["install_date"] ? formatDay(String(s["install_date"])) : "—"}
                  </span>
                </>
              )}
              onRemove={
                canEdit
                  ? (rowId) => removeFrom.mutate({ table: "software_installations", id: rowId })
                  : undefined
              }
              form={
                <p className="text-[0.7rem] text-muted-foreground">
                  As instalações são registradas na tela de Softwares, onde a licença consumida
                  também é escolhida.
                </p>
              }
            />
          </TabsContent>
        )}

        {/* Conexões */}
        {tabs.includes("conexoes") && (
          <TabsContent value="conexoes" className="mt-3">
            <ListPanel
              title="Conexões"
              rows={connectionsQuery.data ?? []}
              empty="Nenhum equipamento conectado."
              render={(c) => <span className="flex-1">{assetName(c["peripheral_id"])}</span>}
              onRemove={
                canEdit ? (rowId) => removeFrom.mutate({ table: "asset_connections", id: rowId }) : undefined
              }
              form={
                canEdit ? (
                  <div className="flex gap-2">
                    <select
                      value={connection}
                      onChange={(e) => setConnection(e.target.value)}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Conectar um equipamento</option>
                      {(catalog?.assets ?? [])
                        .filter((a) => a.id !== id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => addConnection.mutate()}
                      disabled={!connection}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : null
              }
            />
          </TabsContent>
        )}

        {/* Portas de rede */}
        {tabs.includes("portas") && (
          <TabsContent value="portas" className="mt-3">
            <ListPanel
              title="Portas de rede"
              rows={portsQuery.data ?? []}
              empty="Nenhuma porta registrada."
              render={(p) => (
                <>
                  <span className="w-32 truncate font-medium">{String(p["name"]) || "porta"}</span>
                  <Tag className="border-border bg-secondary text-muted-foreground">
                    {PORT_TYPE_LABEL[String(p["port_type"]) as keyof typeof PORT_TYPE_LABEL]}
                  </Tag>
                  <span className="font-mono text-muted-foreground">
                    {String(p["mac"] ?? "") || "sem MAC"}
                  </span>
                </>
              )}
              onRemove={canEdit ? (rowId) => removeFrom.mutate({ table: "network_ports", id: rowId }) : undefined}
              form={
                canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={port.name}
                      onChange={(e) => setPort({ ...port, name: e.target.value })}
                      placeholder="Nome da porta"
                      className="h-8 flex-1 text-xs"
                    />
                    <select
                      value={port.port_type}
                      onChange={(e) => setPort({ ...port, port_type: e.target.value })}
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      {PORT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PORT_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={port.mac}
                      onChange={(e) => setPort({ ...port, mac: e.target.value })}
                      placeholder="MAC"
                      className="h-8 w-40 text-xs"
                    />
                    <Button size="sm" className="h-8" onClick={() => addPort.mutate()}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : null
              }
            />
          </TabsContent>
        )}

        {/* Gerenciamento financeiro */}
        {tabs.includes("financeiro") && (
          <TabsContent value="financeiro" className="mt-3">
            <section className="panel">
              <header className="panel-header">Informação financeira e administrativa</header>
              {!canSeeMoney ? (
                <p className="p-4 text-xs text-muted-foreground">
                  Seu perfil não tem leitura de informação financeira.
                </p>
              ) : !infocom ? (
                <p className="p-4 text-xs text-muted-foreground">
                  Nenhuma informação financeira registrada para este ativo.
                </p>
              ) : (
                <div className="grid gap-0 md:grid-cols-2">
                  <dl className="divide-y divide-border text-xs">
                    <Row label="Número do pedido" value={String(infocom["order_number"] ?? "") || "—"} />
                    <Row label="Nota fiscal" value={String(infocom["invoice_number"] ?? "") || "—"} />
                    <Row label="Data da compra" value={formatDay(String(infocom["buy_date"] ?? "") || null)} />
                    <Row label="Data de entrega" value={formatDay(String(infocom["delivery_date"] ?? "") || null)} />
                    <Row label="Início da garantia" value={formatDay(String(infocom["warranty_start"] ?? "") || null)} />
                    <Row label="Garantia (meses)" value={String(infocom["warranty_months"] ?? 0)} />
                  </dl>
                  <dl className="divide-y divide-border border-t border-border text-xs md:border-l md:border-t-0">
                    <Row label="Valor" value={formatMoneyBR(infocom["value"] as number)} />
                    <Row
                      label="Depreciação"
                      value={DEPRECIATION_LABEL[String(infocom["depreciation"])] ?? "—"}
                    />
                    <Row label="Prazo (meses)" value={String(infocom["depreciation_months"] ?? 0)} />
                    <Row label="Criticidade" value={String(infocom["business_criticity"] ?? "") || "—"} />
                    <Row label="Observações" value={String(infocom["comment"] ?? "") || "—"} />
                  </dl>
                </div>
              )}
            </section>
          </TabsContent>
        )}

        {/* Contadores de página */}
        {tabs.includes("contadores") && (
          <TabsContent value="contadores" className="mt-3">
            <section className="panel p-4 text-xs text-muted-foreground">
              Os contadores de página são preenchidos na ficha da impressora, em
              <code className="mx-1">asset_printers</code>. Sem inventário automático, o número é
              atualizado à mão a cada troca de cartucho.
            </section>
          </TabsContent>
        )}

        {tabs.includes("cartuchos") && (
          <TabsContent value="cartuchos" className="mt-3">
            <section className="panel p-4 text-xs text-muted-foreground">
              O estoque e a instalação de cartuchos ficam em Ativos › Cartuchos, onde o cartucho é
              vinculado a esta impressora.
            </section>
          </TabsContent>
        )}

        {tabs.includes("rack") && (
          <TabsContent value="rack" className="mt-3">
            <section className="panel p-4 text-xs text-muted-foreground">
              Os equipamentos montados neste rack são registrados em
              <code className="mx-1">rack_items</code>, com posição em U e face.
            </section>
          </TabsContent>
        )}

        {/* Chamados */}
        <TabsContent value="chamados" className="mt-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">Chamados deste ativo</header>
            <ul className="divide-y divide-border">
              {(ticketsQuery.data ?? []).length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhum chamado associado.
                </li>
              )}
              {(ticketsQuery.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="font-mono text-[0.72rem] text-muted-foreground">
                    {ticketCode(t.id)}
                  </span>
                  <Link
                    to="/chamados/$id"
                    params={{ id: t.id }}
                    className="flex-1 truncate text-link hover:underline"
                  >
                    {t.title}
                  </Link>
                  <span className="text-muted-foreground">{formatDate(t.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        {/* Bloqueios */}
        <TabsContent value="bloqueios" className="mt-3">
          <section className="panel overflow-hidden">
            <header className="panel-header">Bloqueio de campos</header>
            <p className="border-b border-border p-3 text-[0.72rem] text-muted-foreground">
              Campo travado não é sobrescrito por importação em massa nem por inventário
              automático. Serve para o que foi corrigido à mão e não pode voltar atrás.
            </p>
            <ul className="divide-y divide-border">
              {["name", "asset_tag", "serial_number", "brand", "model", "assigned_name"].map(
                (field) => (
                  <li key={field} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="flex-1 font-mono">{field}</span>
                    <Button
                      size="sm"
                      variant={lockedFields.has(field) ? "secondary" : "outline"}
                      className="h-7 text-xs"
                      disabled={!canEdit}
                      onClick={() => toggleLock.mutate(field)}
                    >
                      {lockedFields.has(field) ? (
                        <>
                          <Lock className="size-3" /> Travado
                        </>
                      ) : (
                        <>
                          <Unlock className="size-3" /> Livre
                        </>
                      )}
                    </Button>
                  </li>
                ),
              )}
            </ul>
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function ListPanel({
  title,
  rows,
  empty,
  render,
  onRemove,
  form,
}: {
  title: string;
  rows: LooseRow[];
  empty: string;
  render: (row: LooseRow) => React.ReactNode;
  onRemove?: ((id: string) => void) | undefined;
  form?: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <header className="panel-header">{title}</header>
      <ul className="divide-y divide-border">
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">{empty}</li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            {render(row)}
            {onRemove && (
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-6"
                aria-label="Remover"
                onClick={() => onRemove(row.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {form && <div className="border-t border-border p-2">{form}</div>}
    </section>
  );
}
