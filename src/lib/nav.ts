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
  /** Objeto da matriz de direitos; sem leitura, o item some do menu. */
  right?: string | undefined;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: NavLink[];
};

const soon = (label: string, slug: string, right?: string): NavLink => ({
  label,
  to: "/modulo/$slug",
  params: { slug },
  soon: true,
  right,
});

export const NAV_HOME: NavLink = { label: "Painel", to: "/painel" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "ativos",
    label: "Ativos",
    icon: HardDrive,
    links: [
      { label: "Computadores", to: "/inventario", search: { tipo: "computador" }, right: "computer" },
      { label: "Notebooks", to: "/inventario", search: { tipo: "notebook" }, right: "computer" },
      { label: "Monitores", to: "/inventario", search: { tipo: "monitor" }, right: "monitor" },
      { label: "Impressoras", to: "/inventario", search: { tipo: "impressora" }, right: "printer" },
      { label: "Equipamentos de rede", to: "/inventario", search: { tipo: "rede" }, right: "networkequipment" },
      { label: "Telefonia", to: "/inventario", search: { tipo: "telefonia" }, right: "phone" },
      { label: "Softwares e licenças", to: "/inventario", search: { tipo: "licenca" }, right: "software" },
      { label: "Todos os ativos", to: "/inventario", search: { tipo: "todos" }, right: "computer" },
    ],
  },
  {
    id: "assistencia",
    label: "Assistência",
    icon: LifeBuoy,
    links: [
      { label: "Chamados", to: "/chamados", right: "ticket" },
      { label: "Criar chamado", to: "/chamados/novo", right: "ticket" },
      { label: "Base de conhecimento", to: "/base-conhecimento", right: "knowledgebase" },
      { label: "Estatísticas", to: "/painel", right: "statistics" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: Building2,
    links: [
      { label: "Fornecedores", to: "/cadastros", search: { aba: "suppliers" }, right: "supplier" },
      soon("Contratos", "contratos", "contract"),
      soon("Contatos", "contatos", "contact"),
      soon("Documentos", "documentos", "document"),
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    icon: Wrench,
    links: [soon("Notas", "notas", "reminder"), soon("Relatórios", "relatorios", "report")],
  },
  {
    id: "administracao",
    label: "Administração",
    icon: Users,
    links: [
      { label: "Usuários", to: "/administracao/usuarios", right: "user" },
      { label: "Grupos", to: "/administracao/grupos", right: "group" },
      { label: "Entidades", to: "/administracao/entidades", right: "entity" },
      { label: "Perfis", to: "/administracao/perfis", right: "profile" },
      soon("Regras", "regras", "rule"),
      soon("Dicionários", "dicionarios", "dictionary"),
      soon("Fila de e-mails", "fila-de-emails", "mailqueue"),
      soon("Logs", "logs", "log"),
      soon("Formulários", "formularios", "form"),
    ],
  },
  {
    id: "configurar",
    label: "Configurar",
    icon: Settings,
    links: [
      { label: "Locais", to: "/cadastros", search: { aba: "locations" }, right: "dropdown" },
      { label: "Setores", to: "/cadastros", search: { aba: "sectors" }, right: "dropdown" },
      soon("Categorias de chamado", "categorias", "dropdown"),
      soon("Níveis de serviço", "slas", "sla"),
      soon("Calendários", "calendarios", "calendar"),
      soon("Notificações", "notificacoes", "notification"),
      soon("Configurações gerais", "configuracoes", "config"),
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
  administracao: "Administração",
  entidades: "Entidades",
  perfis: "Perfis",
  grupos: "Grupos",
  usuarios: "Usuários",
};

const GROUP_OF_SEGMENT: Record<string, string> = {
  painel: "Painel",
  chamados: "Assistência",
  inventario: "Ativos",
  "base-conhecimento": "Assistência",
  cadastros: "Configurar",
  administracao: "Administração",
};

export type Crumb = { label: string; to?: string | undefined };

/** Segmentos que agrupam telas mas não têm página própria. */
const NO_INDEX_ROUTE = new Set(["administracao", "modulo"]);

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
  const firstLabel = CRUMB_LABEL[first] ?? first;
  if (group && group !== firstLabel) crumbs.push({ label: group });

  crumbs.push(
    second && !NO_INDEX_ROUTE.has(first)
      ? { label: firstLabel, to: `/${first}` }
      : { label: firstLabel },
  );

  if (second) {
    crumbs.push({ label: tail ?? CRUMB_LABEL[second] ?? second });
  } else if (tail) {
    crumbs.push({ label: tail });
  }

  return crumbs;
}

export const NAV_ICON = { LayoutDashboard };
