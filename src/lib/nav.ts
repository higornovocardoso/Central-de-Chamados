import {
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  Clock,
  Inbox,
  LayoutDashboard,
  Mail,
  Repeat,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Menu da central. O sistema faz só atendimento de chamados, então o menu é
 * plano: três seções, cada item uma tela. Telas parecidas que antes tinham
 * item próprio (Usuários e Grupos, SLAs e Calendários...) viraram um item só,
 * com abas no topo da página (SECTION_TABS).
 */
export type NavLink = {
  id: string;
  label: string;
  to: string;
  search?: Record<string, string> | undefined;
  icon: LucideIcon;
  /** Objeto da matriz de direitos; sem leitura, o item some do menu. */
  right?: string | undefined;
  /** Outras rotas em que este item fica marcado como ativo. */
  also?: string[] | undefined;
  /** Contador ao lado do rótulo, calculado pelo AppShell. */
  count?: "abertos" | "meus" | "sem_tecnico" | undefined;
};

export type NavSection = { id: string; label: string; links: NavLink[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "atendimento",
    label: "Atendimento",
    links: [
      { id: "painel", label: "Painel", to: "/painel", icon: LayoutDashboard },
      {
        id: "chamados",
        label: "Chamados",
        to: "/chamados",
        icon: Inbox,
        right: "ticket",
        also: ["/chamados/novo", "/chamados/$id", "/assistencia/kanban"],
        count: "abertos",
      },
      {
        id: "meus",
        label: "Meus chamados",
        to: "/chamados",
        search: { filtro: "meus" },
        icon: User,
        right: "ticket",
        count: "meus",
      },
      {
        id: "sem-tecnico",
        label: "Sem técnico",
        to: "/chamados",
        search: { filtro: "nao_atribuidos" },
        icon: CircleHelp,
        right: "ticket",
        count: "sem_tecnico",
      },
      {
        id: "agenda",
        label: "Agenda de tarefas",
        to: "/assistencia/planejamento",
        icon: CalendarDays,
        right: "planning",
      },
      {
        id: "recorrentes",
        label: "Recorrentes",
        to: "/chamados/recorrentes",
        icon: Repeat,
        right: "recurrent",
      },
      {
        id: "base",
        label: "Base de conhecimento",
        to: "/base-conhecimento",
        icon: BookOpen,
        right: "knowledgebase",
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    links: [
      {
        id: "pessoas",
        label: "Pessoas e grupos",
        to: "/administracao/usuarios",
        icon: Users,
        right: "user",
        also: ["/administracao/grupos"],
      },
      {
        id: "empresas",
        label: "Empresas",
        to: "/administracao/entidades",
        icon: Building2,
        right: "entity",
      },
      {
        id: "perfis",
        label: "Perfis de acesso",
        to: "/administracao/perfis",
        icon: ShieldCheck,
        right: "profile",
      },
    ],
  },
  {
    id: "configuracao",
    label: "Configuração",
    links: [
      {
        id: "categorias",
        label: "Categorias",
        to: "/configuracao/categorias",
        icon: Tag,
        right: "dropdown",
      },
      {
        id: "prazos",
        label: "Prazos (SLA)",
        to: "/configuracao/slas",
        icon: Clock,
        right: "sla",
        also: ["/configuracao/calendarios"],
      },
      {
        id: "regras",
        label: "Regras de atribuição",
        to: "/administracao/regras",
        icon: RouteIcon,
        right: "business_rule",
      },
      {
        id: "email",
        label: "E-mail",
        to: "/configuracao/notificacoes",
        icon: Mail,
        right: "notification",
        also: ["/configuracao/coletores", "/administracao/fila-de-emails"],
      },
      {
        id: "geral",
        label: "Geral",
        to: "/configuracao/geral",
        icon: SlidersHorizontal,
        right: "config",
        also: ["/administracao/logs"],
      },
    ],
  },
];

export const NAV_LINKS: NavLink[] = NAV_SECTIONS.flatMap((s) => s.links);

/** Abas no topo das telas que dividem um mesmo item do menu. */
export const SECTION_TABS: { label: string; to: string; right?: string }[][] = [
  [
    { label: "Usuários", to: "/administracao/usuarios", right: "user" },
    { label: "Grupos", to: "/administracao/grupos", right: "group" },
  ],
  [
    { label: "Níveis de serviço", to: "/configuracao/slas", right: "sla" },
    { label: "Calendários", to: "/configuracao/calendarios", right: "calendar" },
  ],
  [
    { label: "Notificações", to: "/configuracao/notificacoes", right: "notification" },
    { label: "Coletores", to: "/configuracao/coletores", right: "collector" },
    { label: "Fila de envio", to: "/administracao/fila-de-emails", right: "mailqueue" },
  ],
  [
    { label: "Configurações", to: "/configuracao/geral", right: "config" },
    { label: "Logs", to: "/administracao/logs", right: "log" },
  ],
];

export function sectionTabsFor(pathname: string) {
  return SECTION_TABS.find((tabs) => tabs.some((t) => t.to === pathname)) ?? null;
}

/** Casa um padrão de rota ("/chamados/$id") com o caminho atual. */
function matchesPattern(pattern: string, pathname: string) {
  const a = pattern.split("/");
  const b = pathname.split("/");
  return a.length === b.length && a.every((seg, i) => seg.startsWith("$") || seg === b[i]);
}

/**
 * Item do menu que fica marcado. Os três atalhos da lista de chamados
 * apontam para a mesma rota e só diferem pelo filtro, então o filtro decide.
 */
export function activeNavId(pathname: string, search: Record<string, unknown>): string | null {
  if (pathname === "/chamados") {
    const filtro = String(search["filtro"] ?? "");
    if (filtro === "meus") return "meus";
    if (filtro === "nao_atribuidos") return "sem-tecnico";
    return "chamados";
  }
  for (const link of NAV_LINKS) {
    if (link.to === pathname && !link.search) return link.id;
    if (link.also?.some((p) => matchesPattern(p, pathname))) return link.id;
  }
  return null;
}

export type Crumb = { label: string; to?: string | undefined };

const EXTRA_LABEL: Record<string, string> = {
  "/chamados/novo": "Novo chamado",
  "/assistencia/kanban": "Quadro",
};

/** Caminho do topo: Central › Tela, ou Chamados › chamado aberto. */
export function breadcrumbFor(
  pathname: string,
  search: Record<string, unknown>,
  tail?: string | undefined,
): Crumb[] {
  const id = activeNavId(pathname, search);
  const link = NAV_LINKS.find((l) => l.id === id);
  if (!link) return [{ label: "Central", to: "/painel" }, { label: tail ?? "Início" }];
  // Na tela do próprio item, o nome do item já basta; o complemento só
  // entra nas telas de dentro dele (um chamado aberto, uma aba).
  if (pathname !== link.to) {
    const tabLabel = SECTION_TABS.flat().find((t) => t.to === pathname)?.label;
    return [
      { label: link.label, to: link.to },
      { label: tail ?? tabLabel ?? EXTRA_LABEL[pathname] ?? pathname.split("/").pop() ?? "" },
    ];
  }
  return [{ label: "Central", to: "/painel" }, { label: link.label }];
}
