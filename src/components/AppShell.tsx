import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  TriangleAlert,
  User,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette } from "@/components/CommandPalette";
import { ProfileDialog } from "@/components/ProfileDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntity } from "@/contexts/entity";
import { activeNavId, breadcrumbFor, NAV_SECTIONS, sectionTabsFor, type NavLink } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { OPEN_STATUSES, type TicketStatus } from "@/lib/tickets";

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
  "aria-current"?: "page" | undefined;
  onClick?: (() => void) | undefined;
  children?: ReactNode;
};
const NavLinkTo = Link as unknown as ComponentType<LooseLinkProps>;

/** Valor do seletor que representa "todas as entidades visíveis". */
const ROOT_TREE = "__tree__";

type NavCounts = { abertos: number; meus: number; sem_tecnico: number };

/** Contadores do menu: uma consulta leve, só status e responsável. */
function useNavCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["nav_counts", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<NavCounts> => {
      const { data, error } = await supabase
        .from("tickets")
        .select("status,assignee_id")
        .eq("is_deleted", false)
        .in("status", OPEN_STATUSES);
      if (error) throw error;
      const rows = (data ?? []) as { status: TicketStatus; assignee_id: string | null }[];
      return {
        abertos: rows.length,
        meus: rows.filter((r) => r.assignee_id === userId).length,
        sem_tecnico: rows.filter((r) => !r.assignee_id).length,
      };
    },
  });
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
  subtitle?: ReactNode;
  breadcrumbTail?: string | undefined;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profileName, can, error: permissionsError } = usePermissions();
  const { entities, selectedId, setSelectedId } = useEntity();
  const location = useRouterState({ select: (s) => s.location });
  const { dark, toggle: toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const counts = useNavCounts(user?.id);

  const search = useMemo(
    () => (location.search ?? {}) as Record<string, unknown>,
    [location.search],
  );
  const activeId = activeNavId(location.pathname, search);
  const canRead = (right: string | undefined) => !right || can(right, "read");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const crumbs = breadcrumbFor(location.pathname, search, breadcrumbTail);
  const tabs = sectionTabsFor(location.pathname)?.filter((t) => canRead(t.right)) ?? null;

  const userName =
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const entityName = entities.find((e) => e.id === selectedId)?.name ?? entities[0]?.name ?? "—";
  const initials = userName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const nav = (onNavigate?: () => void) => (
    <SidebarNav
      activeId={activeId}
      canRead={canRead}
      counts={counts.data}
      onNavigate={onNavigate}
    />
  );

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.8125rem] font-medium">{userName}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="live-dot" /> {profileName || "Sem perfil"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60 p-1.5">
        <DropdownMenuLabel className="text-xs font-normal">
          <span className="block truncate font-medium text-foreground">{userName}</span>
          <span className="block truncate text-muted-foreground">{user?.email ?? ""}</span>
          <span className="block truncate text-muted-foreground">{entityName}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setProfileOpen(true)}>
          <User className="size-4" /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} Tema{" "}
          {dark ? "claro" : "escuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Barra lateral fixa no desktop */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground transition-colors duration-300 lg:flex">
        <div className="-mx-1 flex-1 overflow-y-auto px-1">{nav()}</div>
        <div className="border-t border-sidebar-border pt-3">{userMenu}</div>
      </aside>

      {/* Mesma navegação numa folha lateral no celular e no tablet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[17rem] flex-col gap-4 bg-sidebar p-3 pt-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex-1 overflow-y-auto">{nav(() => setMobileOpen(false))}</div>
          <div className="border-t border-sidebar-border pt-3">{userMenu}</div>
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-topbar px-3 text-topbar-foreground backdrop-blur-md backdrop-saturate-150 transition-colors duration-300 sm:px-5 lg:px-7">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <nav
            aria-label="Caminho"
            className="hidden min-w-0 items-center gap-2 text-[0.8125rem] text-muted-foreground md:flex"
          >
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 && <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
                {crumb.to && index < crumbs.length - 1 ? (
                  <NavLinkTo
                    to={crumb.to}
                    className="whitespace-nowrap transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </NavLinkTo>
                ) : (
                  <span className="truncate font-medium text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {entities.length > 1 && (
              <Select
                value={selectedId ?? entities[0]?.id ?? ROOT_TREE}
                onValueChange={(v) => setSelectedId(v === ROOT_TREE ? null : v)}
              >
                <SelectTrigger
                  className="hidden h-9 w-[190px] text-[0.8125rem] xl:flex"
                  aria-label="Empresa"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {" ".repeat(e.level * 3)}
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:border-input hover:bg-surface sm:w-[260px]"
              aria-label="Buscar (Ctrl+K)"
            >
              <Search className="size-4 shrink-0" />
              <span className="hidden flex-1 truncate text-left sm:block">
                Buscar chamado ou ação
              </span>
              <kbd className="hidden rounded-[5px] border border-b-2 border-input bg-surface px-1.5 font-mono text-[0.65rem] text-muted-foreground sm:inline">
                Ctrl K
              </kbd>
            </button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 [&_svg]:transition-transform [&_svg]:duration-500 active:[&_svg]:-rotate-45"
              aria-label={dark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
              title={dark ? "Tema claro" : "Tema escuro"}
              onClick={toggleTheme}
            >
              {dark ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
            </Button>

            {can("ticket", "create") && (
              <Button size="sm" asChild className="btn-sheen h-9 rounded-lg px-3">
                <Link to="/chamados/novo">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Novo chamado</span>
                </Link>
              </Button>
            )}
          </div>
        </header>

        <main
          key={location.pathname}
          className="relative min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-5 lg:px-8 lg:pt-7"
        >
          <div className="aura" aria-hidden="true" />
          <div className="relative z-[1] mx-auto w-full max-w-[1320px] rise-in">
            {permissionsError && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                <TriangleAlert className="size-4 shrink-0 text-destructive" />
                <span className="flex-1">
                  Não foi possível carregar suas permissões, então o menu está incompleto. Isto é
                  uma falha do sistema, não falta de acesso.
                  <span className="ml-1 text-muted-foreground">({permissionsError.message})</span>
                </span>
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 font-medium hover:bg-secondary"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["my_permissions"] })}
                >
                  Tentar de novo
                </button>
              </div>
            )}

            {(title || actions) && (
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  {title && (
                    <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">{subtitle}</p>
                  )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
            )}

            {tabs && tabs.length > 1 && <SectionTabs tabs={tabs} pathname={location.pathname} />}

            {children}
          </div>
        </main>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        canRead={canRead}
        dark={dark}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}

/**
 * Menu lateral com um realce que desliza até o item ativo. O realce é um só
 * elemento posicionado por medida, por isso anima de um item para outro.
 */
function SidebarNav({
  activeId,
  canRead,
  counts,
  onNavigate,
}: {
  activeId: string | null;
  canRead: (right: string | undefined) => boolean;
  counts: NavCounts | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);
  // Muda quando as permissões mudam o conjunto de itens, e só então.
  const visibleKey = NAV_SECTIONS.flatMap((s) => s.links)
    .filter((l) => canRead(l.right))
    .map((l) => l.id)
    .join(",");

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = wrap?.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`);
    if (!wrap || !el) {
      setMarker(null);
      return;
    }
    setMarker({ top: el.offsetTop, height: el.offsetHeight });
  }, [activeId, visibleKey]);

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 rounded-lg bg-sidebar-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-[transform,height,opacity] duration-[350ms] ease-out-soft"
        style={{
          transform: `translateY(${marker?.top ?? 0}px)`,
          height: marker?.height ?? 0,
          opacity: marker ? 1 : 0,
          top: 0,
        }}
      />
      {NAV_SECTIONS.map((section) => {
        const links = section.links.filter((l) => canRead(l.right));
        if (links.length === 0) return null;
        return (
          <div key={section.id} className="flex flex-col gap-px">
            <span className="px-2.5 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {section.label}
            </span>
            {links.map((link) => (
              <NavItem
                key={link.id}
                link={link}
                active={link.id === activeId}
                count={link.count ? counts?.[link.count] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NavItem({
  link,
  active,
  count,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  count: number | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = link.icon;
  return (
    <span data-nav-id={link.id} className="relative block">
      <NavLinkTo
        to={link.to}
        search={link.search}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-[2.125rem] items-center gap-2.5 rounded-lg px-2.5 text-[0.84375rem] transition-colors duration-200 ${
          active
            ? "font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-hover hover:text-foreground"
        }`}
      >
        <Icon className="size-[1.05rem] shrink-0 opacity-90" />
        <span className="flex-1 truncate">{link.label}</span>
        {count !== undefined && count > 0 && (
          <span
            className={`min-w-5 text-right font-mono text-[0.7rem] tabular-nums ${
              link.count === "sem_tecnico"
                ? "font-medium text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {count}
          </span>
        )}
      </NavLinkTo>
    </span>
  );
}

/** Abas das telas que dividem o mesmo item do menu, com sublinhado que desliza. */
function SectionTabs({
  tabs,
  pathname,
}: {
  tabs: { label: string; to: string }[];
  pathname: string;
}) {
  return (
    <SlidingTabs
      className="mb-5"
      items={tabs.map((t) => ({ key: t.to, label: t.label, to: t.to }))}
      activeKey={pathname}
    />
  );
}

/**
 * Faixa de abas com sublinhado deslizante. Serve tanto para links (to) quanto
 * para botões (onSelect), e aceita um contador por aba.
 */
export function SlidingTabs({
  items,
  activeKey,
  onSelect,
  className = "",
}: {
  items: {
    key: string;
    label: string;
    to?: string;
    search?: Record<string, string>;
    count?: number;
  }[];
  activeKey: string;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(
        `[data-tab-key="${CSS.escape(activeKey)}"]`,
      );
      setInk(el ? { left: el.offsetLeft + 8, width: el.offsetWidth - 16 } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => window.removeEventListener("resize", measure);
  }, [activeKey, items.length]);

  return (
    <div
      ref={ref}
      role="tablist"
      className={`relative flex gap-0.5 overflow-x-auto border-b border-border [scrollbar-width:none] ${className}`}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const inner = (
          <>
            {item.label}
            {item.count !== undefined && (
              <span
                className={`rounded-full px-1.5 font-mono text-[0.68rem] leading-[1.15rem] transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {item.count}
              </span>
            )}
          </>
        );
        const cls = `flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-[0.84375rem] font-medium transition-colors ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`;
        return item.to ? (
          <span key={item.key} data-tab-key={item.key} role="presentation">
            <NavLinkTo
              to={item.to}
              search={item.search}
              className={cls}
              aria-current={active ? "page" : undefined}
            >
              {inner}
            </NavLinkTo>
          </span>
        ) : (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-tab-key={item.key}
            className={cls}
            onClick={() => onSelect?.(item.key)}
          >
            {inner}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-primary transition-[transform,width] duration-[350ms] ease-out-soft"
        style={{
          transform: `translateX(${ink?.left ?? 0}px)`,
          width: ink?.width ?? 0,
          opacity: ink ? 1 : 0,
        }}
      />
    </div>
  );
}

/** Botão "+ Adicionar" no canto do cabeçalho. */
export function AddButton({ to, params }: { to: string; params?: Record<string, string> }) {
  return (
    <Button size="sm" asChild className="h-9">
      <NavLinkTo to={to} params={params}>
        <Plus className="size-4" /> Adicionar
      </NavLinkTo>
    </Button>
  );
}
