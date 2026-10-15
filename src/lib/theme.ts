import { useCallback, useEffect, useState } from "react";

const KEY = "central.tema";

/**
 * Tema claro ou escuro, guardado no navegador. O script em __root.tsx aplica
 * a classe antes da primeira pintura; aqui só lemos e trocamos.
 */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "escuro" : "claro");
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): o tema vale só nesta aba.
    }
    setDark(next);
  }, []);

  return { dark, toggle };
}
