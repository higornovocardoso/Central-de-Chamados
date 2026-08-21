import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { Tag } from "@/components/Tag";
import type { LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityOptions } from "@/hooks/useEntityOptions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";

export const Route = createFileRoute("/_authenticated/gestao/certificados")({
  head: () => ({
    meta: [
      { title: "Certificados" },
      {
        name: "description",
        content: "Certificados digitais e SSL, com aviso antes do vencimento.",
      },
    ],
  }),
  component: Certificados,
});

function Certificados() {
  const { can } = usePermissions();
  const entities = useEntityOptions();
  const options = useGestaoOptions();

  /** Vermelho quando falta menos de 30 dias — um A1 vencido para o escritório. */
  const expiry = (row: LooseRow) => {
    const value = row["expire_date"];
    if (!value) return "—";
    const date = new Date(String(value) + "T12:00:00");
    const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
    const critical = days <= 30;
    return (
      <Tag
        className={
          critical
            ? "border-destructive/40 bg-destructive/15 text-destructive"
            : "border-border bg-secondary text-muted-foreground"
        }
      >
        {date.toLocaleDateString("pt-BR")}
        {days >= 0 ? ` · faltam ${days} dia(s)` : " · vencido"}
      </Tag>
    );
  };

  return (
    <AppShell
      title="Certificados"
      subtitle="e-CNPJ, A1, SSL — o que vence e para o escritório."
      breadcrumbTail="Certificados"
    >
      <CrudTable
        table="certificates"
        queryKey="certificates"
        canWrite={can("certificate", "update")}
        emptyText="Nenhum certificado cadastrado."
        defaults={{
          name: "",
          certificate_type_id: "",
          manufacturer_id: "",
          serial_number: "",
          is_self_signed: false,
          dns_name: "",
          dns_suffix: "",
          expire_date: "",
          entity_id: entities[0]?.value ?? "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Certificado", type: "text", required: true },
          {
            key: "certificate_type_id",
            label: "Tipo",
            type: "select",
            options: options.certificateTypes,
          },
          { key: "dns_name", label: "Nome DNS", type: "text" },
          { key: "expire_date", label: "Validade", type: "date", render: expiry },
          { key: "dns_suffix", label: "Sufixo DNS", type: "text", formOnly: true },
          {
            key: "manufacturer_id",
            label: "Autoridade certificadora",
            type: "select",
            options: options.manufacturers,
            formOnly: true,
          },
          { key: "serial_number", label: "Número de série", type: "text", formOnly: true },
          { key: "is_self_signed", label: "Autoassinado", type: "boolean", formOnly: true },
          { key: "command_used", label: "Comando usado", type: "textarea", formOnly: true },
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
    </AppShell>
  );
}
