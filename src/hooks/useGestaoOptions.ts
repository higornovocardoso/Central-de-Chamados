import { useQuery } from "@tanstack/react-query";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";

export type Option = { value: string; label: string };

const asOptions = (rows: LooseRow[] | undefined): Option[] =>
  (rows ?? []).map((r) => ({ value: r.id, label: String(r["name"]) }));

/**
 * As listas de apoio que quase toda tela de Gestão precisa. Uma consulta só,
 * compartilhada pelo cache do react-query.
 */
export function useGestaoOptions() {
  const query = useQuery({
    queryKey: ["gestao_options"],
    queryFn: async () => {
      const [
        suppliers,
        budgets,
        contractTypes,
        certificateTypes,
        lineTypes,
        contactTypes,
        supplierTypes,
        domainTypes,
        recordTypes,
        applianceTypes,
        environments,
        manufacturers,
        states,
        datacenters,
        headings,
      ] = await Promise.all([
        looseDb.from("suppliers").select("*").order("name"),
        looseDb.from("budgets").select("*").order("name"),
        looseDb.from("contract_types").select("*").order("name"),
        looseDb.from("certificate_types").select("*").order("name"),
        looseDb.from("line_types").select("*").order("name"),
        looseDb.from("contact_types").select("*").order("name"),
        looseDb.from("supplier_types").select("*").order("name"),
        looseDb.from("domain_types").select("*").order("name"),
        looseDb.from("domain_record_types").select("*").order("name"),
        looseDb.from("appliance_types").select("*").order("name"),
        looseDb.from("appliance_environments").select("*").order("name"),
        looseDb.from("manufacturers").select("*").order("name"),
        looseDb.from("asset_states").select("*").order("name"),
        looseDb.from("datacenters").select("*").order("name"),
        looseDb.from("document_headings").select("*").order("name"),
      ]);

      return {
        suppliers: asOptions(suppliers.data ?? []),
        budgets: asOptions(budgets.data ?? []),
        budgetRows: budgets.data ?? [],
        contractTypes: asOptions(contractTypes.data ?? []),
        certificateTypes: asOptions(certificateTypes.data ?? []),
        lineTypes: asOptions(lineTypes.data ?? []),
        contactTypes: asOptions(contactTypes.data ?? []),
        supplierTypes: asOptions(supplierTypes.data ?? []),
        domainTypes: asOptions(domainTypes.data ?? []),
        recordTypes: asOptions(recordTypes.data ?? []),
        applianceTypes: asOptions(applianceTypes.data ?? []),
        environments: asOptions(environments.data ?? []),
        manufacturers: asOptions(manufacturers.data ?? []),
        states: asOptions(states.data ?? []),
        datacenters: asOptions(datacenters.data ?? []),
        headings: asOptions(headings.data ?? []),
        available: !suppliers.error,
      };
    },
  });

  return (
    query.data ?? {
      suppliers: [],
      budgets: [],
      budgetRows: [],
      contractTypes: [],
      certificateTypes: [],
      lineTypes: [],
      contactTypes: [],
      supplierTypes: [],
      domainTypes: [],
      recordTypes: [],
      applianceTypes: [],
      environments: [],
      manufacturers: [],
      states: [],
      datacenters: [],
      headings: [],
      available: false,
    }
  );
}
