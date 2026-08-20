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
      { label: "Periféricos", to: "/inventario", search: { tipo: "periferico" }, right: "peripheral" },
      { label: "Racks", to: "/inventario", search: { tipo: "rack" }, right: "rack" },
      { label: "Cabos", to: "/inventario", search: { tipo: "cabo" }, right: "cable" },
      { label: "Cartões SIM", to: "/inventario", search: { tipo: "sim_card" }, right: "sim" },
      { label: "Todos os ativos", to: "/inventario", search: { tipo: "todos" }, right: "computer" },
      { label: "Softwares e licenças", to: "/inventario/softwares", right: "software" },
      { label: "Cartuchos e consumíveis", to: "/inventario/estoque", right: "cartridge" },
      { label: "Importar CSV", to: "/inventario/importar", right: "import" },
    ],
  },
  {
    id: "assistencia",
    label: "Assistência",
    icon: LifeBuoy,
    links: [
      { label: "Chamados", to: "/chamados", right: "ticket" },
      { label: "Criar chamado", to: "/chamados/novo", right: "ticket" },
      { label: "Chamados recorrentes", to: "/chamados/recorrentes", right: "recurrent" },
      { label: "Kanban", to: "/assistencia/kanban", right: "ticket" },
      { label: "Problemas", to: "/assistencia/problemas", right: "problem" },
      { label: "Mudanças", to: "/assistencia/mudancas", right: "change" },
      { label: "Base de conhecimento", to: "/base-conhecimento", right: "knowledgebase" },
      { label: "Estatísticas", to: "/painel", right: "statistics" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: Building2,
    links: [
      { label: "Contratos", to: "/gestao/contratos", right: "contract" },
      { label: "Fornecedores", to: "/gestao/fornecedores", right: "supplier" },
      { label: "Contatos", to: "/gestao/contatos", right: "contact" },
      { label: "Orçamentos", to: "/gestao/orcamentos", right: "budget" },
      { label: "Certificados", to: "/gestao/certificados", right: "certificate" },
      { label: "Linhas telefônicas", to: "/gestao/linhas", right: "line" },
      { label: "Domínios", to: "/gestao/dominios", right: "domain" },
      { label: "Infraestrutura", to: "/gestao/infra", right: "datacenter" },
      { label: "Documentos", to: "/gestao/documentos", right: "document" },
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    icon: Wrench,
    links: [
      { label: "Projetos", to: "/ferramentas/projetos", right: "project" },
      { label: "Reservas", to: "/ferramentas/reservas", right: "reservation" },
      { label: "Lembretes e feeds", to: "/ferramentas/lembretes", right: "reminder" },
      { label: "Relatórios", to: "/ferramentas/relatorios", right: "report" },
    ],
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
      { label: "Regras de negócio", to: "/administracao/regras", right: "business_rule" },
      { label: "Dicionários e unicidade", to: "/configuracao/dicionarios", right: "dictionary" },
      { label: "Logs", to: "/administracao/logs", right: "log" },
      soon("Fila de e-mails", "fila-de-emails", "mailqueue"),
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
      { label: "Listas suspensas", to: "/configuracao/listas", right: "dropdown" },
      soon("Categorias de chamado", "categorias", "dropdown"),
      { label: "Níveis de serviço", to: "/configuracao/slas", right: "sla" },
      { label: "Calendários", to: "/configuracao/calendarios", right: "calendar" },
      { label: "Notificações", to: "/configuracao/notificacoes", right: "notification" },
      { label: "Coletores de e-mail", to: "/configuracao/coletores", right: "collector" },
      {
        label: "Ações automáticas",
        to: "/configuracao/acoes-automaticas",
        right: "automatic_action",
      },
      { label: "API", to: "/configuracao/api", right: "config" },
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
  configuracao: "Configurar",
  entidades: "Entidades",
  perfis: "Perfis",
  grupos: "Grupos",
  usuarios: "Usuários",
  regras: "Regras de negócio",
  calendarios: "Calendários",
  slas: "Níveis de serviço",
  notificacoes: "Notificações",
  coletores: "Coletores de e-mail",
  "acoes-automaticas": "Ações automáticas",
  recorrentes: "Chamados recorrentes",
  listas: "Listas suspensas",
  softwares: "Softwares",
  estoque: "Cartuchos e consumíveis",
  importar: "Importar CSV",
  gestao: "Gestão",
  contratos: "Contratos",
  fornecedores: "Fornecedores",
  contatos: "Contatos",
  orcamentos: "Orçamentos",
  certificados: "Certificados",
  linhas: "Linhas telefônicas",
  dominios: "Domínios",
  infra: "Infraestrutura",
  documentos: "Documentos",
  assistencia: "Assistência",
  ferramentas: "Ferramentas",
  problemas: "Problemas",
  mudancas: "Mudanças",
  projetos: "Projetos",
  reservas: "Reservas",
  lembretes: "Lembretes e feeds",
  relatorios: "Relatórios",
  kanban: "Kanban",
  dicionarios: "Dicionários e unicidade",
  logs: "Logs",
  api: "API",
};

const GROUP_OF_SEGMENT: Record<string, string> = {
  painel: "Painel",
  chamados: "Assistência",
  inventario: "Ativos",
  "base-conhecimento": "Assistência",
  cadastros: "Configurar",
  administracao: "Administração",
  configuracao: "Configurar",
  gestao: "Gestão",
  assistencia: "Assistência",
  ferramentas: "Ferramentas",
};

export type Crumb = { label: string; to?: string | undefined };

/** Segmentos que agrupam telas mas não têm página própria. */
const NO_INDEX_ROUTE = new Set(["administracao", "modulo", "configuracao", "gestao", "assistencia", "ferramentas"]);

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
