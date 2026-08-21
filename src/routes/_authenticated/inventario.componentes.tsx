import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable } from "@/components/CrudTable";
import { usePermissions } from "@/hooks/usePermissions";
import { useGestaoOptions } from "@/hooks/useGestaoOptions";

export const Route = createFileRoute("/_authenticated/inventario/componentes")({
  head: () => ({
    meta: [
      { title: "Componentes" },
      {
        name: "description",
        content: "Processadores, memórias, discos e placas que compõem os equipamentos.",
      },
    ],
  }),
  component: Componentes,
});

/** Os tipos de componente do GLPI, na ordem em que ele os lista. */
const KIND_OPTIONS = [
  { value: "processador", label: "Processador" },
  { value: "memoria", label: "Memória" },
  { value: "disco", label: "Disco" },
  { value: "placa_rede", label: "Placa de rede" },
  { value: "placa_video", label: "Placa de vídeo" },
  { value: "placa_som", label: "Placa de som" },
  { value: "controladora", label: "Controladora" },
  { value: "bateria", label: "Bateria" },
  { value: "fonte", label: "Fonte" },
  { value: "bios", label: "BIOS" },
  { value: "gabinete_componente", label: "Gabinete" },
  { value: "outro", label: "Outro" },
];

function Componentes() {
  const { can } = usePermissions();
  const options = useGestaoOptions();

  return (
    <AppShell
      title="Componentes"
      subtitle="As peças que ficam dentro dos equipamentos, para saber o que trocar antes de comprar."
      breadcrumbTail="Componentes"
    >
      <CrudTable
        table="components"
        queryKey="components"
        canWrite={can("component", "update")}
        emptyText="Nenhum componente cadastrado."
        defaults={{
          name: "",
          kind: "outro",
          manufacturer_id: "",
          specification: "",
          comment: "",
        }}
        fields={[
          { key: "name", label: "Componente", type: "text", required: true },
          { key: "kind", label: "Tipo", type: "select", options: KIND_OPTIONS },
          {
            key: "manufacturer_id",
            label: "Fabricante",
            type: "select",
            options: options.manufacturers,
          },
          { key: "specification", label: "Especificação", type: "text" },
          { key: "comment", label: "Comentário", type: "textarea", formOnly: true },
        ]}
      />

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Aqui fica o catálogo. Para dizer quais peças estão dentro de um equipamento, abra o ativo e
        use a aba de componentes.
      </p>
    </AppShell>
  );
}
