import { Link } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";

/** Lista ou quadro: dois jeitos de ver a mesma fila. */
export function VisaoToggle({ atual }: { atual: "lista" | "quadro" }) {
  const base =
    "relative z-[1] inline-flex h-7 items-center gap-1.5 px-3 text-[0.8125rem] font-medium transition-colors";
  return (
    <div className="relative inline-grid grid-cols-2 rounded-[0.5625rem] bg-muted p-[3px]">
      <span
        aria-hidden="true"
        className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-[0.4375rem] bg-surface shadow-[0_1px_3px_#1018281f] transition-transform duration-[350ms] ease-out-soft"
        style={{ transform: atual === "quadro" ? "translateX(100%)" : undefined }}
      />
      <Link
        to="/chamados"
        className={`${base} ${atual === "lista" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-current={atual === "lista" ? "page" : undefined}
      >
        <List className="size-4" /> Lista
      </Link>
      <Link
        to="/assistencia/kanban"
        className={`${base} ${atual === "quadro" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-current={atual === "quadro" ? "page" : undefined}
      >
        <LayoutGrid className="size-4" /> Quadro
      </Link>
    </div>
  );
}
