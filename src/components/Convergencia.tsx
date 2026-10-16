import type { CSSProperties } from "react";

/**
 * Linhas de luz que vêm das bordas da tela e terminam no centro, com um
 * pulso correndo por cada uma: os chamados chegando à central. É só
 * decoração de fundo (aria-hidden) e para quieta com animação reduzida.
 *
 * O desenho usa "slice", então o centro do SVG fica sempre no centro da
 * tela, atrás do cartão que a página põe ali.
 */
const LINHAS: { d: string; dur: number; atraso: number }[] = [
  { d: "M0 110 C 360 110, 520 410, 720 450", dur: 6.5, atraso: 0 },
  { d: "M0 450 C 300 450, 480 450, 720 450", dur: 7.5, atraso: 2.1 },
  { d: "M0 800 C 340 800, 540 500, 720 450", dur: 8, atraso: 4.2 },
  { d: "M1440 150 C 1080 150, 920 420, 720 450", dur: 7, atraso: 1.2 },
  { d: "M1440 520 C 1160 520, 960 470, 720 450", dur: 6, atraso: 3.4 },
  { d: "M1440 840 C 1100 840, 900 500, 720 450", dur: 8.5, atraso: 0.6 },
  { d: "M300 0 C 300 240, 560 400, 720 450", dur: 9, atraso: 2.8 },
  { d: "M1120 0 C 1120 250, 880 400, 720 450", dur: 7.8, atraso: 5 },
  { d: "M440 900 C 440 660, 600 500, 720 450", dur: 8.8, atraso: 1.7 },
  { d: "M1020 900 C 1020 680, 840 500, 720 450", dur: 6.8, atraso: 3.9 },
];

export function Convergencia({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    >
      <defs>
        <linearGradient id="conv-base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="0.6" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--ice)" stopOpacity="0.35" />
        </linearGradient>
        <filter id="conv-brilho" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {LINHAS.map((l) => (
        <path key={`b${l.d}`} d={l.d} fill="none" stroke="url(#conv-base)" strokeWidth="1" />
      ))}

      <g filter="url(#conv-brilho)">
        {LINHAS.map((l) => (
          <path
            key={`p${l.d}`}
            d={l.d}
            pathLength={1000}
            fill="none"
            stroke="var(--ice)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="70 1000"
            strokeDashoffset="1060"
            style={
              {
                animation: `pulso-linha ${l.dur}s cubic-bezier(0.45, 0, 0.2, 1) ${l.atraso}s infinite`,
              } as CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  );
}
