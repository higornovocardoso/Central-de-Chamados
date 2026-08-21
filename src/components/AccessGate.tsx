import { AppShell } from "@/components/AppShell";
import { usePermissions } from "@/hooks/usePermissions";
import type { RightAction } from "@/lib/permissions";

export type EstadoAcesso = "carregando" | "liberado" | "negado";

/**
 * Enquanto as permissões estão sendo buscadas, `can()` responde não — o que
 * fazia a tela dizer "seu perfil não tem acesso" a quem tem. Aqui o estado
 * de carregamento é separado da negativa, para a mensagem só aparecer
 * quando for verdade.
 */
export function useAcesso(objeto: string, acao: RightAction = "read"): EstadoAcesso {
  const { can, loading } = usePermissions();
  if (loading) return "carregando";
  return can(objeto, acao) ? "liberado" : "negado";
}

export function AvisoAcesso({
  titulo,
  estado,
  mensagem,
}: {
  titulo: string;
  estado: EstadoAcesso;
  mensagem: string;
}) {
  return (
    <AppShell title={titulo}>
      <div className="panel p-8 text-center text-xs text-muted-foreground">
        {estado === "carregando" ? "Carregando suas permissões…" : mensagem}
      </div>
    </AppShell>
  );
}
