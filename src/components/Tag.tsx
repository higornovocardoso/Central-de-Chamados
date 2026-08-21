import type { ReactNode } from "react";

export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all duration-150 hover:-translate-y-px ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
