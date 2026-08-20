import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";

export const Route = createFileRoute("/_authenticated/gestao/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Helpdesk T.I." },
      {
        name: "description",
        content: "Fornecedores, prestadores e operadoras, com contatos e contratos.",
      },
    ],
  }),
  component: Fornecedores,
});

function Fornecedores() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();
  const [selected, setSelected] = useState<LooseRow | null>(null);

  const contactsQuery = useQuery({
    queryKey: ["contact_suppliers", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("contact_suppliers")
        .select("*")
        .eq("supplier_id", String(selected?.id))
        .order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["contract_suppliers_by_supplier", selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("contract_suppliers")
        .select("*")
        .eq("supplier_id", String(selected?.id))
        .order("id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <AppShell
      title="Fornecedores"
      subtitle="Quem vende, quem presta serviço e quem atende quando o problema é externo."
      breadcrumbTail="Fornecedores"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <CrudTable
          table="suppliers"
          queryKey="suppliers"
          canWrite={can("supplier", "update")}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          emptyText="Nenhum fornecedor cadastrado."
          defaults={{
            name: "",
            supplier_type_id: "",
            contact_email: "",
            phone: "",
            document: "",
            website: "",
            city: "",
            entity_id: entities[0]?.value ?? "",
            notes: "",
          }}
          fields={[
            { key: "name", label: "Fornecedor", type: "text", required: true },
            {
              key: "supplier_type_id",
              label: "Tipo",
              type: "select",
              options: options.supplierTypes,
            },
            { key: "phone", label: "Telefone", type: "text" },
            { key: "contact_email", label: "E-mail", type: "text" },
            { key: "city", label: "Cidade", type: "text" },
            { key: "document", label: "CNPJ", type: "text", formOnly: true },
            { key: "website", label: "Site", type: "text", formOnly: true },
            { key: "address", label: "Endereço", type: "text", formOnly: true },
            { key: "state", label: "Estado", type: "text", formOnly: true },
            { key: "postal_code", label: "CEP", type: "text", formOnly: true },
            {
              key: "entity_id",
              label: "Entidade",
              type: "select",
              options: entities,
              formOnly: true,
            },
            { key: "notes", label: "Observações", type: "textarea", formOnly: true },
          ]}
        />

        <section className="panel h-fit p-4">
          {!selected ? (
            <p className="text-center text-xs text-muted-foreground">
              Escolha um fornecedor para ver o resumo.
            </p>
          ) : (
            <>
              <h2 className="mb-2 text-xs font-semibold">{String(selected["name"])}</h2>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Contatos</dt>
                  <dd className="tabular-nums">{contactsQuery.data?.length ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Contratos</dt>
                  <dd className="tabular-nums">{contractsQuery.data?.length ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">CNPJ</dt>
                  <dd>{String(selected["document"] ?? "") || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Site</dt>
                  <dd className="truncate">{String(selected["website"] ?? "") || "—"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[0.7rem] text-muted-foreground">
                Os vínculos com contatos e contratos são feitos nas telas de Contatos e Contratos.
              </p>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
