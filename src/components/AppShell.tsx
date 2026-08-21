import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  TriangleAlert,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntity } from "@/contexts/entity";
import { breadcrumbFor, NAV_GROUPS, type NavLink } from "@/lib/nav";

/**
 * O menu é montado a partir de dados (src/lib/nav.ts), então os destinos são
 * strings genéricas. O Link do TanStack é tipado por rota, por isso a versão
 * destipada abaixo — o roteador continua validando em tempo de execução.
 */
type LooseLinkProps = {
  to: string;
  params?: Record<string, string> | undefined;
  search?: Record<string, string> | undefined;
  className?: string | undefined;
  title?: string | undefined;
  onClick?: (() => void) | undefined;
  children?: ReactNode;
};
const NavLinkTo = Link as unknown as ComponentType<LooseLinkProps>;

/** Valor do seletor que representa "todas as entidades visíveis". */
const ROOT_TREE = "__tree__";

const COLLAPSE_KEY = "glpi.sidebar.collapsed";
const OPEN_GROUPS_KEY = "glpi.sidebar.groups";
const THEME_KEY = "glpi.theme";

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // O GLPI abre no claro. Seguir o tema do sistema operacional fazia quem
    // usa Windows no escuro cair num visual que não é o do GLPI, então só a
    // escolha explícita no botão vale — o escuro continua disponível.
    const stored = localStorage.getItem(THEME_KEY);
    const next = stored === "dark";
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return { dark, toggle };
}

function isLinkActive(link: NavLink, pathname: string, search: Record<string, unknown>) {
  const base = link.to.replace("/$slug", "");
  const slug = link.params?.["slug"];
  if (slug) return pathname === `/modulo/${slug}`;
  if (pathname !== base) return false;
  if (!link.search) return true;
  return Object.entries(link.search).every(([key, value]) => String(search[key] ?? "") === value);
}

export function AppShell({
  children,
  title,
  subtitle,
  breadcrumbTail,
  actions,
}: {
  children: ReactNode;
  title?: string | undefined;
  subtitle?: string | undefined;
  breadcrumbTail?: string | undefined;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dark, toggle } = useTheme();
  const { user, profileName, can, error: permissionsError } = usePermissions();
  const { entities, selectedId, setSelectedId } = useEntity();
  const location = useRouterState({ select: (s) => s.location });
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState("");

  const search = useMemo(() => (location.search ?? {}) as Record<string, unknown>, [location.search]);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    const stored = localStorage.getItem(OPEN_GROUPS_KEY);
    setOpenGroups(stored ? (JSON.parse(stored) as string[]) : ["assistencia"]);
  }, []);

  // Mantém aberto o grupo da tela atual, como o GLPI faz ao navegar.
  const activeGroup = useMemo(() => {
    for (const group of NAV_GROUPS) {
      if (group.links.some((l) => isLinkActive(l, location.pathname, search))) return group.id;
    }
    return null;
  }, [location.pathname, search]);

  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
    }
  }, [activeGroup]);

  function persistGroups(next: string[]) {
    setOpenGroups(next);
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
  }

  function toggleGroup(id: string) {
    persistGroups(openGroups.includes(id) ? openGroups.filter((g) => g !== id) : [...openGroups, id]);
  }

  function toggleCollapse() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ to: "/chamados", search: { busca: term.trim() || undefined } as never });
  }

  const crumbs = breadcrumbFor(location.pathname, breadcrumbTail);
  const perfil = profileName;

  // O GLPI mostra o nome antes do e-mail, e a entidade logo abaixo.
  const userName =
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const entityName =
    entities.find((e) => e.id === selectedId)?.name ?? "Entidade raiz (árvore)";

  const sidebar = (
    <SidebarNav
      collapsed={collapsed}
      openGroups={openGroups}
      onToggleGroup={toggleGroup}
      pathname={location.pathname}
      search={search}
      canRead={(right) => !right || can(right, "read")}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen bg-background">
        {/* Menu lateral — desktop */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex ${
            collapsed ? "w-14" : "w-60"
          }`}
        >
          <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
            <Link to="/painel" className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
                <LayoutDashboard className="size-4" />
              </span>
              {!collapsed && (
                <span className="truncate text-sm font-semibold tracking-tight">Helpdesk T.I.</span>
              )}
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto py-2">{sidebar}</div>

          <button
            type="button"
            onClick={toggleCollapse}
            className="flex h-9 items-center justify-center gap-1.5 border-t border-sidebar-border text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            {!collapsed && "Recolher menu"}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior */}
          <header className="sticky top-0 z-30 border-b border-border bg-topbar text-topbar-foreground">
            <div className="flex h-12 items-center gap-2 px-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Abrir menu">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                >
                  <SheetTitle className="border-b border-sidebar-border px-3 py-3 text-sm font-semibold text-sidebar-foreground">
                    Helpdesk T.I.
                  </SheetTitle>
                  <div className="overflow-y-auto py-2">{sidebar}</div>
                </SheetContent>
              </Sheet>

              <Select
                value={selectedId ?? ROOT_TREE}
                onValueChange={(v) => setSelectedId(v === ROOT_TREE ? null : v)}
              >
                <SelectTrigger
                  className="hidden h-8 w-[220px] text-xs sm:flex"
                  aria-label="Entidade"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_TREE}>Entidade raiz (árvore)</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {" ".repeat(e.level * 3)}
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <form onSubmit={submitSearch} className="relative ml-auto hidden w-64 md:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar chamado..."
                  className="h-8 pl-8 text-xs"
                />
              </form>

              <div className="ml-auto flex items-center gap-1 md:ml-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={toggle}
                  aria-label={dark ? "Tema claro" : "Tema escuro"}
                >
                  {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-8" asChild>
                  <a
                    href="https://glpi-project.org/documentation/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Ajuda"
                  >
                    <CircleHelp className="size-4" />
                  </a>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Bloco do usuário do GLPI: avatar redondo, nome em cima
                        e a entidade atual embaixo, em duas linhas. */}
                    <Button size="sm" variant="ghost" className="h-10 gap-2 px-2 text-xs">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <User className="size-4" />
                      </span>
                      <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                        <span className="max-w-[150px] truncate font-medium">
                          {userName}
                        </span>
                        <span className="max-w-[150px] truncate text-[0.7rem] text-muted-foreground">
                          {entityName}
                        </span>
                      </span>
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs font-normal">
                      <span className="block truncate font-medium">{user?.email ?? "Usuário"}</span>
                      <span className="text-muted-foreground">Perfil: {perfil}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/abrir-chamado" target="_blank" rel="noreferrer">
                        Formulário dos colaboradores
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="size-4" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Caminho de navegação */}
            <div className="flex h-8 items-center gap-1.5 border-t border-border bg-muted/60 px-3 text-xs text-muted-foreground">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="size-3 opacity-60" />}
                  {crumb.to ? (
                    <NavLinkTo to={crumb.to} className="hover:text-foreground hover:underline">
                      {crumb.label}
                    </NavLinkTo>
                  ) : (
                    <span className={index === crumbs.length - 1 ? "text-foreground" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-3 py-4 lg:px-5">
            {/*
              Sem permissões o menu fica só com o Painel, e antes disso não
              havia aviso nenhum: o sistema parecia vazio em vez de quebrado.
            */}
            {permissionsError && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                <TriangleAlert className="size-4 shrink-0 text-destructive" />
                <span className="flex-1">
                  Não foi possível carregar suas permissões, então o menu está
                  incompleto. Isto é uma falha do sistema, não falta de acesso.
                  <span className="ml-1 text-muted-foreground">
                    ({permissionsError.message})
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 font-medium hover:bg-secondary"
                  onClick={() =>
                    queryClient.invalidateQueries({ queryKey: ["my_permissions"] })
                  }
                >
                  Tentar de novo
                </button>
              </div>
            )}
            {(title || actions) && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  {title && <h1 className="text-base font-semibold">{title}</h1>}
                  {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">{actions}</div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarNav({
  collapsed,
  openGroups,
  onToggleGroup,
  pathname,
  search,
  canRead,
  onNavigate,
}: {
  collapsed: boolean;
  openGroups: string[];
  onToggleGroup: (id: string) => void;
  pathname: string;
  search: Record<string, unknown>;
  canRead: (right: string | undefined) => boolean;
  onNavigate: () => void;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

  // "Find menu" do GLPI: filtra grupos e itens pelo rótulo. Com filtro ativo
  // todos os grupos que casam ficam abertos, senão o filtro não serviria.
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  return (
    <nav className="text-sm">
      {!collapsed && (
        <div className="px-2 pb-2">
          <label className="relative block">
            <span className="sr-only">Buscar no menu</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar no menu"
              className="h-7 w-full rounded-sm border border-sidebar-border bg-black/20 pl-7 pr-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/45 focus:border-sidebar-primary focus:outline-none"
            />
          </label>
        </div>
      )}

      <NavLinkTo
        to="/painel"
        onClick={onNavigate}
        className={`nav-link ${pathname === "/painel" ? "nav-link-active" : ""} ${
          collapsed ? "justify-center" : ""
        }`}
        title="Painel"
      >
        <LayoutDashboard className="size-4 shrink-0" />
        {!collapsed && <span>Painel</span>}
      </NavLinkTo>

      {NAV_GROUPS.map((group) => {
        // Um grupo sem nenhum item legível some do menu, como no GLPI.
        const readable = group.links.filter((l) => canRead(l.right));
        const groupMatches = matches(group.label);
        const links = readable.filter((l) => groupMatches || matches(l.label));
        if (links.length === 0) return null;

        const open = needle ? true : openGroups.includes(group.id);
        const Icon = group.icon;
        const hasActive = links.some((l) => isLinkActive(l, pathname, search));

        const first = links[0];
        if (collapsed && first) {
          return (
            <Tooltip key={group.id}>
              <TooltipTrigger asChild>
                <NavLinkTo
                  to={first.to}
                  params={first.params}
                  search={first.search}
                  onClick={onNavigate}
                  className={`nav-link justify-center ${hasActive ? "nav-link-active" : ""}`}
                >
                  <Icon className="size-4" />
                </NavLinkTo>
              </TooltipTrigger>
              <TooltipContent side="right">{group.label}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => onToggleGroup(group.id)}
              className={`nav-link ${hasActive || open ? "nav-link-active" : ""}`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{group.label}</span>
              <ChevronDown
                className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"} opacity-70`}
              />
            </button>
            {open && (
              <ul className="nav-sub">
                {links.map((link) => {
                  const active = isLinkActive(link, pathname, search);
                  return (
                    <li key={`${link.to}-${link.label}`}>
                      <NavLinkTo
                        to={link.to}
                        params={link.params}
                        search={link.search}
                        onClick={onNavigate}
                        className={`nav-sub-link ${active ? "nav-sub-active" : ""}`}
                      >
                        <span className="truncate">{link.label}</span>
                        {link.soon && (
                          <span className="ml-auto rounded-sm bg-black/25 px-1 text-[0.6rem] uppercase tracking-wide opacity-70">
                            em breve
                          </span>
                        )}
                      </NavLinkTo>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Botão "+ Adicionar" no canto do cabeçalho, como no GLPI. */
export function AddButton({ to, params }: { to: string; params?: Record<string, string> }) {
  return (
    <Button size="sm" asChild className="h-8">
      <NavLinkTo to={to} params={params}>
        <Plus className="size-4" /> Adicionar
      </NavLinkTo>
    </Button>
  );
}
