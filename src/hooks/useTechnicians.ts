import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/glpi-db";

/**
 * Quem pode receber um chamado: todo usuário cujo perfil concede alteração de
 * chamados. Antes da fase 2 isso era a lista de papéis admin/tecnico, e essa
 * continua sendo a resposta enquanto a migration não estiver aplicada.
 */
export function useTechnicians() {
  return useQuery({
    queryKey: ["technicians"],
    queryFn: async (): Promise<string[]> => {
      const { data: rights, error: rightsError } = await db
        .from("profile_rights")
        .select("profile_id")
        .eq("object_key", "ticket")
        .eq("can_update", true);

      if (rightsError) return legacyTechnicians();

      const profileIds = (rights ?? []).map((r) => r.profile_id);
      if (profileIds.length === 0) return [];

      const { data: auths, error: authError } = await db
        .from("user_authorizations")
        .select("user_id")
        .in("profile_id", profileIds);

      if (authError) return legacyTechnicians();
      return Array.from(new Set((auths ?? []).map((a) => a.user_id)));
    },
  });
}

async function legacyTechnicians(): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("user_id,role");
  return (data ?? [])
    .filter((r) => r.role === "admin" || r.role === "tecnico")
    .map((r) => r.user_id);
}
