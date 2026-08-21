import { useNavigate } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * O seletor de painel do GLPI, aquele dropdown que no original mostra
 * "Parc" e troca entre os painéis instalados.
 *
 * O GLPI traz quatro painéis de fábrica (central, assets, assistance e
 * mini_tickets). Aqui há dois de verdade — assistência e ativos —, e só
 * entram na lista os que o perfil do usuário pode ver.
 */
export type PainelId = "assistencia" | "ativos";

const PAINEIS: { id: PainelId; label: string; to: string; right: string }[] = [
  { id: "assistencia", label: "Assistência", to: "/painel", right: "ticket" },
  { id: "ativos", label: "Ativos", to: "/inventario/painel", right: "computer" },
];

export function DashboardSelector({ atual }: { atual: PainelId }) {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const disponiveis = PAINEIS.filter((p) => can(p.right, "read"));

  // Com um painel só, o seletor não informa nada — o GLPI também o esconde.
  if (disponiveis.length < 2) return null;

  return (
    <Select
      value={atual}
      onValueChange={(v) => {
        const alvo = PAINEIS.find((p) => p.id === v);
        if (alvo) navigate({ to: alvo.to } as never);
      }}
    >
      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Escolher painel">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {disponiveis.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
