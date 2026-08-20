import {
  Building2,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Estrutura de menu do GLPI 10. Os itens que ainda não têm tela própria
 * apontam para /modulo/$slug, que renderiza um "em construção" — assim o
 * menu fica completo desde já e cada módulo entra no lugar certo.
 */
export type NavLink = {
  label: string;
  to: string;
  params?: Record<string, string> | undefined;
  search?: Record<string, string> | undefined;
  /** Marca telas que ainda não existem, para exibir o selo "em breve". */
  soon?: boolean | undefined;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: NavLink[];
};

const soon = (label: string, slug: string): NavLink => ({
  label,
  to: "/modulo/$slug",
  params: { slug },
  soon: true,
});

export const NAV_HOME: NavLink = { label: "Painel", to: "/painel" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "ativos",
    label: "Ativos",
    icon: HardDrive,
    links: [
      { label: "Computadores", to: "/inventario", search: { tipo: "computador" } },
      { label: "Notebooks", to: "/inventario", search: { tipo: "notebook" } },
      { label: "Monitores", to: "/inventario", search: { tipo: "monitor" } },
      { label: "Impressoras", to: "/inventario", search: { tipo: "impressora" } },
      { label: "Equipamentos de rede", to: "/inventario", search: { tipo: "rede" } },
      { label: "Telefonia", to: "/inventario", search: { tipo: "telefonia" } },
      { label: "Softwares e licenças", to: "/inventario", search: { tipo: "licenca" } },
      { label: "Todos os ativos", to: "/inventario", search: { tipo: "todos" } },
    ],
  },
  {
    id: "assistencia",
    label: "Assistência",
    icon: LifeBuoy,
    links: [
      { label: "Chamados", to: "/chamados" },
      { label: "Criar chamado", to: "/chamados/novo" },
      { label: "Base de conhecimento", to: "/base-conhecimento" },
      { label: "Estatísticas", to: "/painel" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: Building2,
    links: [
      { label: "Fornecedores", to: "/cadastros", search: { aba: "suppliers" } },
      soon("Contratos", "contratos"),
      soon("Contatos", "contatos"),
      soon("Documentos", "documentos"),
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    icon: Wrench,
    links: [soon("Notas", "notas"), soon("Relatórios", "relatorios")],
  },
  {
    id: "administracao",
    label: "Administração",
    icon: Users,
    links: [
      soon("Usuários", "usuarios"),
      soon("Grupos", "grupos"),
      soon("Entidades", "entidades"),
      soon("Perfis", "perfis"),
      { label: "Locais", to: "/cadastros", search: { aba: "locations" } },
      { label: "Setores", to: "/cadastros", search: { aba: "sectors" } },
    ],
  },
  {
    id: "configurar",
    label: "Configurar",
    icon: Settings,
    links: [
      soon("Categorias de chamado", "categorias"),
      soon("SLAs", "slas"),
      soon("Status", "status"),
      soon("Configurações gerais", "configuracoes"),
    ],
  },
];

/** Rótulos das telas que já existem, para montar o caminho de navegação. */
const CRUMB_LABEL: Record<string, string> = {
  painel: "Painel",
  chamados: "Chamados",
  novo: "Criar chamado",
  inventario: "Ativos",
  "base-conhecimento": "Base de conhecimento",
  cadastros: "Cadastros",
  modulo: "Módulo",
};

const GROUP_OF_SEGMENT: Record<string, string> = {
  painel: "Painel",
  chamados: "Assistência",
  inventario: "Ativos",
  "base-conhecimento": "Assistência",
  cadastros: "Administração",
};

export type Crumb = { label: string; to?: string | undefined };

/**
 * Caminho no formato do GLPI: Início > Grupo > Tela.
 * O último item nunca vira link, igual ao original.
 */
export function breadcrumbFor(pathname: string, tail?: string | undefined): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return [{ label: "Início" }];

  const second = segments[1];
  const crumbs: Crumb[] = [{ label: "Início", to: "/painel" }];

  const group = GROUP_OF_SEGMENT[first];
  if (group) crumbs.push({ label: group });

  crumbs.push(
    second ? { label: CRUMB_LABEL[first] ?? first, to: `/${first}` } : { label: CRUMB_LABEL[first] ?? first },
  );

  if (second) {
    crumbs.push({ label: tail ?? CRUMB_LABEL[second] ?? second });
  } else if (tail) {
    crumbs.push({ label: tail });
  }

  return crumbs;
}

export const NAV_ICON = { LayoutDashboard };
