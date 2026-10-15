import { useEffect, useRef, useState } from "react";

/**
 * Número que conta de onde estava até o valor novo. Na primeira vez sobe do
 * zero; depois anda só a diferença, para uma atualização não recomeçar tudo.
 */
export function useCountUp(target: number, duracaoMs = 900) {
  const [valor, setValor] = useState(0);
  const atual = useRef(0);

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const de = atual.current;
    if (reduzir || de === target) {
      atual.current = target;
      setValor(target);
      return;
    }
    const inicio = performance.now();
    let frame = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duracaoMs);
      const v = de + (target - de) * (1 - Math.pow(1 - p, 3));
      atual.current = v;
      setValor(v);
      if (p < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [target, duracaoMs]);

  return Math.round(valor);
}
