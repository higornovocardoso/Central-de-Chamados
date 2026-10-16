import { usePermissions } from "@/hooks/usePermissions";

/**
 * Compatibilidade com as telas escritas antes da fase 2. Os três papéis
 * antigos agora são derivados da matriz de direitos:
 *   isAdmin  -> pode administrar perfis
 *   isStaff  -> pode alterar chamados
 * Telas novas devem usar usePermissions() direto.
 */
export function useRoles() {
  const { user, permissions, loading, can } = usePermissions();

  return {
    user,
    profiles: permissions.profiles,
    isAdmin: can("profile", "update"),
    isStaff: can("ticket", "update"),
    loading,
  };
}
