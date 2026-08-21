import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import type { LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";

export const Route = createFileRoute("/_authenticated/gestao/dominios")({
  head: () => ({
    meta: [
      { title: "Domínios" },
      {
        name: "description",
        content: "Domínios com validade e as entradas DNS de cada um.",
      },
    ],
  }),
  component: Dominios,
});

function Dominios() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();
  const canWrite = can("domain", "update");
  const [selected, setSelected] = useState<LooseRow | null>(null);

  const expiry = (row: LooseRow) => {
    const value = row["expire_date"];
    if (!value) return "—";
    const date = new Date(String(value) + "T12:00:00");
    const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
    return (
      <Tag
        className={
          days <= 30
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-border bg-secondary text-muted-foreground"
        }
      >
        {date.toLocaleDateString("pt-BR")}
      </Tag>
    );
  };

  return (
    <AppShell
      title="Domínios"
      subtitle="O domínio do escritório, a validade do registro e as entradas DNS."
      breadcrumbTail="Domínios"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
        <CrudTable
          table="domains"
          queryKey="domains"
          canWrite={canWrite}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          emptyText="Nenhum domínio cadastrado."
          defaults={{
            name: "",
            domain_type_id: "",
            supplier_id: "",
            registration_date: "",
            expire_date: "",
            entity_id: entities[0]?.value ?? "",
            comment: "",
          }}
          fields={[
            { key: "name", label: "Domínio", type: "text", required: true },
            { key: "domain_type_id", label: "Tipo", type: "select", options: options.domainTypes },
            { key: "expire_date", label: "Validade", type: "date", render: expiry },
            {
              key: "supplier_id",
              label: "Registrador",
              type: "select",
              options: options.suppliers,
            },
            { key: "registration_date", label: "Registro", type: "date", formOnly: true },
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

        <div>
          {!selected ? (
            <section className="panel p-6 text-center text-xs text-muted-foreground">
              Escolha um domínio para ver as entradas DNS.
            </section>
          ) : (
            <>
              <h2 className="mb-2 text-xs font-semibold">
                Entradas DNS de {String(selected["name"])}
              </h2>
              <CrudTable
                table="domain_records"
                queryKey={"domain_records_" + selected.id}
                canWrite={canWrite}
                emptyText="Nenhuma entrada DNS."
                defaults={{
                  domain_id: selected.id,
                  name: "",
                  record_type_id: "",
                  data: "",
                  ttl: 3600,
                }}
                fields={[
                  { key: "name", label: "Nome", type: "text", required: true },
                  {
                    key: "record_type_id",
                    label: "Tipo",
                    type: "select",
                    options: options.recordTypes,
                  },
                  { key: "data", label: "Valor", type: "text" },
                  { key: "ttl", label: "TTL", type: "number", formOnly: true },
                  { key: "comment", label: "Comentário", type: "text", formOnly: true },
                ]}
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
