import { useMemo } from "react";

export type GanttTask = {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  percent: number;
};

const DAY = 86_400_000;

/**
 * Cronograma simples em barras. Não é uma biblioteca de GANTT — é a mesma
 * leitura que o GANTT do GLPI entrega: onde cada tarefa começa, onde termina
 * e quanto já andou.
 */
export function Gantt({ tasks }: { tasks: GanttTask[] }) {
  const scale = useMemo(() => {
    const dates = tasks
      .flatMap((t) => [t.start, t.end])
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(`${d}T12:00:00`).getTime());

    if (dates.length === 0) return null;

    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const span = Math.max(DAY, max - min);
    return { min, max, span };
  }, [tasks]);

  if (!scale) {
    return (
      <p className="p-6 text-center text-xs text-muted-foreground">
        Nenhuma tarefa com datas planejadas. Preencha início e prazo para o cronograma aparecer.
      </p>
    );
  }

  const monthMarks = buildMonths(scale.min, scale.max);

  return (
    <div className="overflow-x-auto p-3">
      <div className="min-w-[640px]">
        {/* Régua de meses */}
        <div className="relative mb-2 h-5 border-b border-border">
          {monthMarks.map((mark) => (
            <span
              key={mark.time}
              className="absolute top-0 -translate-x-1/2 text-[0.65rem] uppercase tracking-wide text-muted-foreground"
              style={{ left: `${((mark.time - scale.min) / scale.span) * 100}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>

        <ul className="space-y-1.5">
          {tasks.map((task) => {
            const start = task.start ? new Date(`${task.start}T12:00:00`).getTime() : scale.min;
            const end = task.end ? new Date(`${task.end}T12:00:00`).getTime() : start + DAY;
            const left = ((start - scale.min) / scale.span) * 100;
            const width = Math.max(1.5, ((end - start) / scale.span) * 100);
            const late = end < Date.now() && task.percent < 100;

            return (
              <li key={task.id} className="grid grid-cols-[180px_1fr] items-center gap-2">
                <span className="truncate text-xs" title={task.name}>
                  {task.name}
                </span>
                <div className="relative h-5 rounded bg-secondary/60">
                  <div
                    className={`absolute top-0 h-5 rounded ${
                      late ? "bg-destructive/25" : "bg-primary/25"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <div
                      className={`h-full rounded ${late ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, Math.max(0, task.percent))}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[0.62rem] font-medium tabular-nums text-foreground">
                      {task.percent}%
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function buildMonths(min: number, max: number) {
  const marks: { time: number; label: string }[] = [];
  const cursor = new Date(min);
  cursor.setDate(1);

  while (cursor.getTime() <= max && marks.length < 24) {
    if (cursor.getTime() >= min) {
      marks.push({
        time: cursor.getTime(),
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return marks;
}
