import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";

export const Route = createFileRoute("/_authenticated/gestao/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos" },
      {
        name: "description",
        content: "Agenda de contatos dos fornecedores e prestadores de serviço.",
      },
    ],
  }),
  component: Contatos,
});

function Contatos() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();

  return (
    <AppShell
      title="Contatos"
      subtitle="Quem chamar quando o problema é do fornecedor."
      breadcrumbTail="Contatos"
    >
      <CrudTable
        table="contacts"
        queryKey="contacts"
        canWrite={can("contact", "update")}
        emptyText="Nenhum contato cadastrado."
        defaults={{
          name: "",
          first_name: "",
          contact_type_id: "",
          title: "",
          phone: "",
          mobile: "",
          email: "",
          entity_id: entities[0]?.value ?? "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Sobrenome", type: "text", required: true },
          { key: "first_name", label: "Nome", type: "text" },
          {
            key: "contact_type_id",
            label: "Tipo",
            type: "select",
            options: options.contactTypes,
          },
          { key: "phone", label: "Telefone", type: "text" },
          { key: "mobile", label: "Celular", type: "text" },
          { key: "email", label: "E-mail", type: "text" },
          { key: "title", label: "Cargo", type: "text", formOnly: true },
          { key: "phone2", label: "Telefone 2", type: "text", formOnly: true },
          { key: "fax", label: "Fax", type: "text", formOnly: true },
          { key: "address", label: "Endereço", type: "text", formOnly: true },
          { key: "city", label: "Cidade", type: "text", formOnly: true },
          {
            key: "entity_id",
            label: "Entidade",
            type: "select",
            options: entities,
            formOnly: true,
          },
          { key: "comment", label: "Observações", type: "textarea", formOnly: true },
        ]}
      />
    </AppShell>
  );
}
