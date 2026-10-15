import type { ReactNode } from "react";

export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[1.375rem] items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
