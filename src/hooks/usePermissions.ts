import { useQuery } from "@tanstack/react-query";
import { useSessionUser } from "@/hooks/useSession";
import {
  EMPTY_PERMISSIONS,
  can as canDo,
  fetchMyPermissions,
  hasFlag as hasFlagIn,
  mainProfileName,
  type Permissions,
  type RightAction,
} from "@/lib/permissions";

/**
 * Direitos do usuário atual, do jeito que o GLPI monta: perfis, matriz de
 * direitos por objeto, direitos granulares de assistência e as entidades
 * visíveis. Uma consulta só, compartilhada por toda a interface.
 */
export function usePermissions() {
  const { user, loading: sessionLoading } = useSessionUser();

  const query = useQuery({
    queryKey: ["my_permissions", user?.id],
    queryFn: fetchMyPermissions,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const permissions: Permissions = query.data ?? EMPTY_PERMISSIONS;

  return {
    user,
    permissions,
    loading: sessionLoading || query.isLoading,
    error: query.error as Error | null,
    can: (object: string, action: RightAction) => canDo(permissions, object, action),
    hasFlag: (flag: string) => hasFlagIn(permissions, flag),
    profileName: mainProfileName(permissions),
    entities: permissions.entities,
  };
}
