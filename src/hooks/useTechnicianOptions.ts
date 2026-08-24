import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTechnicians } from "@/hooks/useTechnicians";

export type Option = { value: string; label: string };

/**
 * Os técnicos já prontos para uma lista suspensa: o useTechnicians devolve
 * apenas os identificadores, e quase toda tela precisava cruzar com profiles
 * por conta própria para ter o nome.
 */
export function useTechnicianOptions(): Option[] {
  const technicians = useTechnicians();

  const people = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .order("full_name");
      return data ?? [];
    },
  });

  const nameById = new Map((people.data ?? []).map((p) => [p.id, p.full_name || p.email]));

  return (technicians.data ?? []).map((id) => ({
    value: id,
    label: nameById.get(id) ?? "Usuário",
  }));
}
