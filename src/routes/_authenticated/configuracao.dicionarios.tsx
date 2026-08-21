import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/configuracao/dicionarios")({
  // O menu do GLPI lista estes objetos separadamente; aqui eles
  // dividem a mesma tela, então a aba vem pela URL.
  validateSearch: (search: Record<string, unknown>): { aba: "dicionarios" | "unicidade" } => {
    const aba = String(search["aba"] ?? "");
    return { aba: (["dicionarios", "unicidade"] as const).includes(aba as never)
      ? (aba as "dicionarios" | "unicidade")
      : "dicionarios" };
  },
  head: () => ({
    meta: [
      { title: "Dicionários e unicidade — Helpdesk T.I." },
      {
        name: "description",
        content: "Normalização de nomes na entrada e regras de campo único.",
      },
    ],
  }),
  component: Dicionarios,
});

const TARGETS = [
  { value: "manufacturer", label: "Fabricantes" },
  { value: "software", label: "Softwares" },
  { value: "model", label: "Modelos" },
  { value: "operating_system", label: "Sistemas operacionais" },
];

const ACTIONS = [
  { value: "bloquear", label: "Bloquear o registro" },
  { value: "avisar", label: "Apenas registrar no log" },
];

function Dicionarios() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can } = usePermissions();
  const canWrite = can("dictionary", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);

  return (
    <AppShell
      title="Dicionários e unicidade"
      subtitle='Para "DELL INC.", "Dell Inc" e "dell" virarem a mesma coisa.'
      breadcrumbTail="Dicionários"
    >
      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
        <TabsList className="min-h-8">
          <TabsTrigger value="dicionarios" className="text-xs">
            Dicionários
          </TabsTrigger>
          <TabsTrigger value="unicidade" className="text-xs">
            Unicidade de campos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dicionarios" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
            <div>
              <CrudTable
                table="dictionaries"
                queryKey="dictionaries"
                canWrite={canWrite}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                emptyText="Nenhum dicionário cadastrado."
                defaults={{ name: "", target: "manufacturer", is_active: true, comment: "" }}
                fields={[
                  { key: "name", label: "Dicionário", type: "text", required: true },
                  { key: "target", label: "Aplica-se a", type: "select", options: TARGETS },
                  { key: "is_active", label: "Ativo", type: "boolean" },
                  { key: "comment", label: "Comentário", type: "text" },
                ]}
              />
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                A troca acontece na entrada do dado, pela função{" "}
                <code>apply_dictionary</code> no banco. A primeira regra que casar vence.
              </p>
            </div>

            <div>
              {!selected ? (
                <section className="panel p-6 text-center text-xs text-muted-foreground">
                  Escolha um dicionário para ver as regras.
                </section>
              ) : (
                <>
                  <h2 className="mb-2 text-xs font-semibold">
                    Regras de {String(selected["name"])}
                  </h2>
                  <CrudTable
                    table="dictionary_entries"
                    queryKey={"dictionary_entries_" + selected.id}
                    orderBy="sort"
                    canWrite={canWrite}
                    emptyText="Nenhuma regra."
                    defaults={{
                      dictionary_id: selected.id,
                      match_value: "",
                      replace_value: "",
                      is_regex: false,
                      is_active: true,
                      sort: 100,
                    }}
                    fields={[
                      { key: "match_value", label: "Quando for", type: "text", required: true },
                      { key: "replace_value", label: "Vira", type: "text", required: true },
                      { key: "is_regex", label: "Expressão", type: "boolean" },
                      { key: "sort", label: "Ordem", type: "number", formOnly: true },
                      { key: "is_active", label: "Ativa", type: "boolean", formOnly: true },
                    ]}
                  />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="unicidade" className="mt-3">
          <CrudTable
            table="field_unicity"
            queryKey="field_unicity"
            canWrite={can("field_unicity", "update")}
            emptyText="Nenhuma regra de unicidade."
            defaults={{
              name: "",
              item_type: "asset",
              fields: "",
              action: "bloquear",
              is_active: true,
              comment: "",
            }}
            fields={[
              { key: "name", label: "Regra", type: "text", required: true },
              {
                key: "fields",
                label: "Campo",
                type: "text",
                render: (row) => {
                  const value = row["fields"];
                  return Array.isArray(value) ? value.join(", ") : String(value ?? "—");
                },
              },
              { key: "action", label: "Quando repetir", type: "select", options: ACTIONS },
              { key: "is_active", label: "Ativa", type: "boolean" },
              { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
            ]}
          />
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            O gatilho no banco confere na gravação do ativo. Em "bloquear", o registro é recusado;
            em "avisar", o caso vai para o histórico do ativo sem impedir a gravação.
          </p>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
