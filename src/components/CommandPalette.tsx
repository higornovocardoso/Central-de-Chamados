import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRead: (right: string | undefined) => boolean;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[13vh] max-w-[38rem] translate-y-0 gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-[18px] [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        {/* A busca aberta é o que está em foco: ganha o feixe na borda. */}
        <div className="feixe shadow-[var(--shadow-3)]" style={{ borderRadius: 18 }}>
          <Command
            className="overflow-hidden bg-popover [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input-wrapper]_svg]:size-[1.1rem] [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-[0.9375rem]"
            style={{ borderRadius: 17 }}
          >
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
                      onSelect={() =>
                        go(() => navigate({ to: "/chamados/$id", params: { id: t.id } }))
                      }
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
                      go(() =>
                        navigate({ to: "/chamados", search: { busca: term.trim() } as never }),
                      )
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
              </CommandGroup>

              <CommandGroup heading="Ir para">
                {NAV_LINKS.filter((l) => canRead(l.right)).map((l) => {
                  const Icon = l.icon;
                  return (
                    <CommandItem
                      key={l.id}
                      value={`ir ${l.label}`}
                      onSelect={() =>
                        go(() => navigate({ to: l.to, search: (l.search ?? {}) as never }))
                      }
                    >
                      <Icon /> {l.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}
