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
      soon("Painel de ativos", "painel-de-ativos", "dashboard"),
      { label: "Computadores", to: "/inventario", search: { tipo: "computador" }, right: "computer" },
      { label: "Monitores", to: "/inventario", search: { tipo: "monitor" }, right: "monitor" },
      { label: "Software", to: "/inventario/softwares", search: { aba: "versoes" }, right: "software" },
      { label: "Equipamentos de rede", to: "/inventario", search: { tipo: "rede" }, right: "networkequipment" },
      soon("Componentes", "componentes", "component"),
      { label: "Periféricos", to: "/inventario", search: { tipo: "periferico" }, right: "peripheral" },
      { label: "Impressoras", to: "/inventario", search: { tipo: "impressora" }, right: "printer" },
      { label: "Cartuchos", to: "/inventario/estoque", search: { aba: "cartuchos" }, right: "cartridge" },
      { label: "Consumíveis", to: "/inventario/estoque", search: { aba: "consumiveis" }, right: "consumable" },
      { label: "Telefones", to: "/inventario", search: { tipo: "telefonia" }, right: "phone" },
      { label: "Racks", to: "/inventario", search: { tipo: "rack" }, right: "rack" },
      soon("Gabinetes", "gabinetes", "enclosure"),
      soon("PDUs", "pdus", "pdu"),
      soon("Dispositivos passivos", "dispositivos-passivos", "passivedevice"),
      soon("Não gerenciados", "nao-gerenciados", "unmanaged"),
      { label: "Cabos", to: "/inventario", search: { tipo: "cabo" }, right: "cable" },
      { label: "Cartões SIM", to: "/inventario", search: { tipo: "sim_card" }, right: "sim" },
      { label: "Global", to: "/inventario", search: { tipo: "todos" }, right: "computer" },
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
      { label: "Problemas", to: "/assistencia/problemas", right: "problem" },
      { label: "Mudanças", to: "/assistencia/mudancas", right: "change" },
      { label: "Kanban", to: "/assistencia/kanban", right: "ticket" },
      soon("Planejamento", "planejamento", "planning"),
      soon("Estatísticas", "estatisticas", "statistics"),
      { label: "Chamados recorrentes", to: "/chamados/recorrentes", right: "recurrent" },
      soon("Mudanças recorrentes", "mudancas-recorrentes", "change"),
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: Building2,
    links: [
      { label: "Licenças", to: "/inventario/softwares", search: { aba: "licencas" }, right: "license" },
      { label: "Orçamentos", to: "/gestao/orcamentos", right: "budget" },
      { label: "Fornecedores", to: "/gestao/fornecedores", right: "supplier" },
      { label: "Contatos", to: "/gestao/contatos", right: "contact" },
      { label: "Contratos", to: "/gestao/contratos", right: "contract" },
      { label: "Documentos", to: "/gestao/documentos", right: "document" },
      { label: "Linhas telefônicas", to: "/gestao/linhas", right: "line" },
      { label: "Certificados", to: "/gestao/certificados", right: "certificate" },
      { label: "Datacenters", to: "/gestao/infra", search: { aba: "datacenters" }, right: "datacenter" },
      { label: "Clusters", to: "/gestao/infra", search: { aba: "clusters" }, right: "cluster" },
      { label: "Domínios", to: "/gestao/dominios", right: "domain" },
      soon("Appliances", "appliances", "appliance"),
      soon("Bancos de dados", "bancos-de-dados", "database"),
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    icon: Wrench,
    links: [
      { label: "Projetos", to: "/ferramentas/projetos", right: "project" },
      { label: "Lembretes", to: "/ferramentas/lembretes", search: { aba: "lembretes" }, right: "reminder" },
      { label: "Feeds RSS", to: "/ferramentas/lembretes", search: { aba: "rss" }, right: "rssfeed" },
      { label: "Base de conhecimento", to: "/base-conhecimento", right: "knowledgebase" },
      { label: "Reservas", to: "/ferramentas/reservas", right: "reservation" },
      { label: "Relatórios", to: "/ferramentas/relatorios", right: "report" },
      soon("Buscas salvas", "buscas-salvas", "saved_search"),
      soon("Análise de impacto", "analise-de-impacto", "ticket"),
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
      { label: "Regras", to: "/administracao/regras", right: "business_rule" },
      { label: "Dicionários", to: "/configuracao/dicionarios", search: { aba: "dicionarios" }, right: "dictionary" },
      { label: "Perfis", to: "/administracao/perfis", right: "profile" },
      soon("Fila de e-mails", "fila-de-emails", "mailqueue"),
      { label: "Logs", to: "/administracao/logs", right: "log" },
      soon("Inventário", "inventario-automatico", "import"),
    ],
  },
  {
    id: "configurar",
    label: "Configurar",
    icon: Settings,
    links: [
      { label: "Listas suspensas", to: "/configuracao/listas", right: "dropdown" },
      { label: "Locais", to: "/cadastros", search: { aba: "locations" }, right: "dropdown" },
      { label: "Setores", to: "/cadastros", search: { aba: "sectors" }, right: "dropdown" },
      { label: "Notificações", to: "/configuracao/notificacoes", right: "notification" },
      { label: "Níveis de serviço", to: "/configuracao/slas", right: "sla" },
      soon("Configurações gerais", "configuracoes", "config"),
      { label: "Unicidade de campos", to: "/configuracao/dicionarios", search: { aba: "unicidade" }, right: "field_unicity" },
      { label: "Ações automáticas", to: "/configuracao/acoes-automaticas", right: "automatic_action" },
      soon("Autenticação", "autenticacao", "config"),
      { label: "Coletores de e-mail", to: "/configuracao/coletores", right: "collector" },
      { label: "Calendários", to: "/configuracao/calendarios", right: "calendar" },
      soon("Links externos", "links-externos", "external_link"),
      soon("Plugins", "plugins", "plugin"),
      { label: "API", to: "/configuracao/api", right: "config" },
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
  regras: "Regras",
  calendarios: "Calendários",
  slas: "Níveis de serviço",
  notificacoes: "Notificações",
  coletores: "Coletores de e-mail",
  "acoes-automaticas": "Ações automáticas",
  recorrentes: "Chamados recorrentes",
  listas: "Listas suspensas",
  softwares: "Software",
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
  infra: "Datacenters e clusters",
  documentos: "Documentos",
  assistencia: "Assistência",
  ferramentas: "Ferramentas",
  problemas: "Problemas",
  mudancas: "Mudanças",
  projetos: "Projetos",
  reservas: "Reservas",
  lembretes: "Lembretes",
  relatorios: "Relatórios",
  kanban: "Kanban",
  dicionarios: "Dicionários",
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
