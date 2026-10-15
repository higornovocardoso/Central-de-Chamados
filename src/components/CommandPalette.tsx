import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Moon, Plus, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { NAV_LINKS } from "@/lib/nav";
import { STATUS_DOT, STATUS_LABEL, ticketCode, type TicketStatus } from "@/lib/tickets";

type Hit = { id: string; title: string; status: TicketStatus };

/**
 * Busca rápida (Ctrl+K): chamados, telas do menu e ações. Os chamados vêm
 * do banco pelo título enquanto a pessoa digita; o resto é filtrado aqui.
 */
export function CommandPalette({
  open,
  onOpenChange,
  canRead,
  dark,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRead: (right: string | undefined) => boolean;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 180);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const hits = useQuery({
    queryKey: ["busca_rapida", debounced],
    enabled: open,
    staleTime: 15_000,
    queryFn: async (): Promise<Hit[]> => {
      let q = supabase
        .from("tickets")
        .select("id,title,status")
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .limit(8);
      // O termo vai como parâmetro; % e _ do próprio texto viram literais.
      if (debounced) q = q.ilike("title", `%${debounced.replace(/[%_]/g, "\\$&")}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });

  function go(run: () => void) {
    onOpenChange(false);
    run();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* O cmdk filtra pelo texto de cada item; os chamados já chegam
          filtrados do banco, então o filtro dele fica desligado. */}
      <CommandInput
        placeholder="Busque um chamado, uma tela ou uma ação"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>Nada encontrado para “{term}”.</CommandEmpty>

        {(hits.data ?? []).length > 0 && (
          <CommandGroup heading={debounced ? "Chamados" : "Chamados recentes"}>
            {(hits.data ?? []).map((t) => (
              <CommandItem
                key={t.id}
                value={`${t.title} ${t.id}`}
                keywords={[debounced]}
                onSelect={() => go(() => navigate({ to: "/chamados/$id", params: { id: t.id } }))}
              >
                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                  {ticketCode(t.id)}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
                  {STATUS_LABEL[t.status]}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ações">
          {term.trim() && (
            <CommandItem
              value={`buscar ${term}`}
              onSelect={() =>
                go(() => navigate({ to: "/chamados", search: { busca: term.trim() } as never }))
              }
            >
              <Search /> Buscar “{term.trim()}” na lista de chamados
            </CommandItem>
          )}
          {canRead("ticket") && (
            <CommandItem
              value="novo chamado abrir criar"
              onSelect={() => go(() => navigate({ to: "/chamados/novo" }))}
            >
              <Plus /> Novo chamado
            </CommandItem>
          )}
          <CommandItem value="alternar tema claro escuro" onSelect={() => go(onToggleTheme)}>
            {dark ? <Sun /> : <Moon />} Mudar para o tema {dark ? "claro" : "escuro"}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Ir para">
          {NAV_LINKS.filter((l) => canRead(l.right)).map((l) => {
            const Icon = l.icon;
            return (
              <CommandItem
                key={l.id}
                value={`ir ${l.label}`}
                onSelect={() => go(() => navigate({ to: l.to, search: (l.search ?? {}) as never }))}
              >
                <Icon /> {l.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
