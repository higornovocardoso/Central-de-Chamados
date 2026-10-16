import { useQuery } from "@tanstack/react-query";
import { db, type EntityRow } from "@/integrations/supabase/glpi-db";

/** Entidades no formato de opção de lista, já indentadas pela árvore. */
export function useEntityOptions() {
  const query = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await db.from("entities").select("*").order("path");
      if (error) throw new Error(error.message);
      return (data ?? []) as EntityRow[];
    },
  });

  return (query.data ?? []).map((e) => ({
    value: e.id,
    label: `${" ".repeat(e.level * 3)}${e.name}`,
  }));
}
