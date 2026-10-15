import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

const KEY = "central.tema";

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

/**
 * Tema claro ou escuro, guardado no navegador. O script em __root.tsx aplica
 * a classe antes da primeira pintura; aqui só lemos e trocamos.
 *
 * Onde o navegador permite, a troca acontece num círculo que cresce a partir
 * do ponto clicado (View Transitions). Sem suporte, ou com animação reduzida,
 * troca direto.
 */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback((origem?: { x: number; y: number }) => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");

    const aplicar = () => {
      html.classList.toggle("dark", next);
      try {
        localStorage.setItem(KEY, next ? "escuro" : "claro");
      } catch {
        // Sem armazenamento (aba anônima, bloqueio): o tema vale só nesta aba.
      }
      flushSync(() => setDark(next));
    };

    const doc = document as ViewTransitionDoc;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduzir) {
      aplicar();
      return;
    }

    const x = origem?.x ?? window.innerWidth - 80;
    const y = origem?.y ?? 28;
    const raio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // As transições de cor dos elementos brigariam com o círculo; ficam
    // desligadas só durante a troca.
    html.classList.add("sem-transicao");
    const transicao = doc.startViewTransition(aplicar);
    transicao.ready
      .then(() => {
        html.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`],
          },
          {
            duration: 650,
            easing: "cubic-bezier(0.22, 0.8, 0.24, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);
    transicao.finished.finally(() => html.classList.remove("sem-transicao"));
  }, []);

  return { dark, toggle };
}
