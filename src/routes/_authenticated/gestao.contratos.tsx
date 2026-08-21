import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";
import { formatMoneyBR } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/gestao/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos" },
      {
        name: "description",
        content: "Contratos com vigência, renovação, aviso prévio e alerta de vencimento.",
      },
    ],
  }),
  component: Contratos,
});

const RENEWALS = [
  { value: "tacita", label: "Tácita" },
  { value: "expressa", label: "Expressa" },
  { value: "nenhuma", label: "Sem renovação" },
];

/** Data de término a partir do início e do período inicial em meses. */
function endDate(row: LooseRow) {
  const start = row["start_date"];
  const months = Number(row["initial_months"] ?? 0);
  if (!start || !months) return null;
  const date = new Date(`${String(start)}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date;
}

function Contratos() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();
  const queryClient = useQueryClient();
  const canWrite = can("contract", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);
  const [asset, setAsset] = useState("");
  const [supplier, setSupplier] = useState("");

  const assetsQuery = useQuery({
    queryKey: ["assets_options"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id,name,asset_tag").order("name");
      return data ?? [];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["contract_items", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("contract_items")
        .select("*")
        .eq("contract_id", String(selected?.id))
        .order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["contract_suppliers", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("contract_suppliers")
        .select("*")
        .eq("contract_id", String(selected?.id))
        .order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const link = useMutation({
    mutationFn: async (input: { table: string; column: string; value: string }) => {
      if (!input.value) throw new Error("Escolha um registro.");
      const { error } = await looseDb
        .from(input.table)
        .insert({ contract_id: selected?.id, [input.column]: input.value });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setAsset("");
      setSupplier("");
      queryClient.invalidateQueries({ queryKey: ["contract_items", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["contract_suppliers", selected?.id] });
    },
    onError: (e: Error) => toast.error("Não foi possível vincular", { description: e.message }),
  });

  const unlink = useMutation({
    mutationFn: async (input: { table: string; id: string }) => {
      const { error } = await looseDb.from(input.table).delete().eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_items", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["contract_suppliers", selected?.id] });
    },
  });

  const assetName = (id: unknown) =>
    (assetsQuery.data ?? []).find((a) => a.id === String(id))?.name ?? "Ativo";
  const supplierName = (id: unknown) =>
    options.suppliers.find((s) => s.value === String(id))?.label ?? "Fornecedor";

  return (
    <AppShell
      title="Contratos"
      subtitle="Vigência, renovação e aviso prévio — com alerta antes de vencer."
      breadcrumbTail="Contratos"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div>
          <CrudTable
            table="contracts"
            queryKey="contracts"
            canWrite={canWrite}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            emptyText="Nenhum contrato cadastrado."
            defaults={{
              name: "",
              number: "",
              contract_type_id: "",
              entity_id: entities[0]?.value ?? "",
              start_date: "",
              initial_months: 12,
              notice_months: 1,
              renewal: "tacita",
              renewal_months: 12,
              invoice_period_months: 1,
              alert_days: 30,
              value: 0,
              comment: "",
            }}
            fields={[
              { key: "name", label: "Contrato", type: "text", required: true },
              { key: "number", label: "Número", type: "text" },
              {
                key: "contract_type_id",
                label: "Tipo",
                type: "select",
                options: options.contractTypes,
              },
              { key: "start_date", label: "Início", type: "date" },
              {
                key: "id",
                label: "Término",
                type: "text",
                readOnly: true,
                render: (row) => {
                  const end = endDate(row);
                  if (!end) return "—";
                  const expired = end < new Date();
                  return (
                    <Tag
                      className={
                        expired
                          ? "border-destructive/40 bg-destructive/15 text-destructive"
                          : "border-border bg-secondary text-muted-foreground"
                      }
                    >
                      {end.toLocaleDateString("pt-BR")}
                    </Tag>
                  );
                },
              },
              {
                key: "value",
                label: "Valor",
                type: "number",
                render: (row) => formatMoneyBR(row["value"] as number),
              },
              { key: "initial_months", label: "Período inicial (meses)", type: "number", formOnly: true },
              { key: "notice_months", label: "Aviso prévio (meses)", type: "number", formOnly: true },
              { key: "renewal", label: "Renovação", type: "select", options: RENEWALS, formOnly: true },
              { key: "renewal_months", label: "Renova por (meses)", type: "number", formOnly: true },
              {
                key: "invoice_period_months",
                label: "Faturamento (meses)",
                type: "number",
                formOnly: true,
              },
              { key: "alert_days", label: "Avisar com (dias)", type: "number", formOnly: true },
              { key: "account_number", label: "Conta contábil", type: "text", formOnly: true },
              {
                key: "budget_id",
                label: "Orçamento",
                type: "select",
                options: options.budgets,
                formOnly: true,
              },
              {
                key: "entity_id",
                label: "Entidade",
                type: "select",
                options: entities,
                formOnly: true,
              },
              { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            A ação automática "Alertas de gestão" conta os contratos que vencem dentro do prazo de
            aviso de cada um.
          </p>
        </div>

        <div>
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              Escolha um contrato para vincular ativos e fornecedores.
            </section>
          ) : (
            <Tabs defaultValue="ativos">
              <TabsList className="min-h-8">
                <TabsTrigger value="ativos" className="text-xs">
                  Ativos ({itemsQuery.data?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="fornecedores" className="text-xs">
                  Fornecedores ({suppliersQuery.data?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="custos" className="text-xs">
                  Custos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ativos" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Ativos cobertos</header>
                  <ul className="divide-y divide-border">
                    {(itemsQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-4 text-xs text-muted-foreground">
                        Nenhum ativo vinculado.
                      </li>
                    )}
                    {(itemsQuery.data ?? []).map((i) => (
                      <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="flex-1 truncate">{assetName(i["asset_id"])}</span>
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Desvincular"
                            onClick={() => unlink.mutate({ table: "contract_items", id: i.id })}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="flex gap-2 border-t border-border p-2">
                      <select
                        value={asset}
                        onChange={(e) => setAsset(e.target.value)}
                        className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Vincular um ativo</option>
                        {(assetsQuery.data ?? []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          link.mutate({ table: "contract_items", column: "asset_id", value: asset })
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="fornecedores" className="mt-3">
                <section className="panel overflow-hidden">
                  <header className="panel-header">Fornecedores</header>
                  <ul className="divide-y divide-border">
                    {(suppliersQuery.data ?? []).length === 0 && (
                      <li className="px-3 py-4 text-xs text-muted-foreground">
                        Nenhum fornecedor vinculado.
                      </li>
                    )}
                    {(suppliersQuery.data ?? []).map((s) => (
                      <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="flex-1 truncate">{supplierName(s["supplier_id"])}</span>
                        {canWrite && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label="Desvincular"
                            onClick={() => unlink.mutate({ table: "contract_suppliers", id: s.id })}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <div className="flex gap-2 border-t border-border p-2">
                      <select
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Vincular um fornecedor</option>
                        {options.suppliers.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          link.mutate({
                            table: "contract_suppliers",
                            column: "supplier_id",
                            value: supplier,
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="custos" className="mt-3">
                <CrudTable
                  table="contract_costs"
                  queryKey={`contract_costs_${selected.id}`}
                  orderBy="begin_date"
                  canWrite={canWrite}
                  emptyText="Nenhum custo lançado."
                  defaults={{
                    contract_id: selected.id,
                    name: "",
                    begin_date: "",
                    end_date: "",
                    value: 0,
                    budget_id: "",
                  }}
                  fields={[
                    { key: "name", label: "Descrição", type: "text", required: true },
                    { key: "begin_date", label: "De", type: "date" },
                    {
                      key: "value",
                      label: "Valor",
                      type: "number",
                      render: (row) => formatMoneyBR(row["value"] as number),
                    },
                    { key: "end_date", label: "Até", type: "date", formOnly: true },
                    {
                      key: "budget_id",
                      label: "Orçamento",
                      type: "select",
                      options: options.budgets,
                      formOnly: true,
                    },
                  ]}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AppShell>
  );
}
