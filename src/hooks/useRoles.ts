import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/useSession";

export type RoleRow = { user_id: string; role: "admin" | "tecnico" | "usuario" };

export function useRoles() {
  const { user } = useSessionUser();

  const rolesQuery = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const roles = rolesQuery.data ?? [];
  const mine = roles.filter((r) => r.user_id === user?.id).map((r) => r.role);

  return {
    user,
    roles,
    isAdmin: mine.includes("admin"),
    isStaff: mine.includes("admin") || mine.includes("tecnico"),
    loading: rolesQuery.isLoading,
  };
}
