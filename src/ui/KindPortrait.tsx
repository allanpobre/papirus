import type { CSSProperties } from 'react'

/*
 * O retrato de uma ficha sem imagem: um desenho simples do tipo dela (pessoa, lugar, reino…) na cor do tipo, com a
 * inicial pequena num canto. No lugar da letra gigante de antes: dois personagens diferentes ficam parecidos, mas
 * personagem, lugar e facção não se confundem, e nada é sorteado.
 */
const ART: Record<string, string> = {
  // Busto: cabeça e ombros.
  personagem: 'M30 12a9 9 0 1 1 0 18a9 9 0 0 1 0-18ZM12 52C12 39 20 34 30 34s18 5 18 18Z',
  // Montanhas e sol.
  lugar: 'M6 48L22 22l10 14l8-10l14 22ZM44 11a5 5 0 1 1 0 10a5 5 0 0 1 0-10Z',
  // Castelo com ameias.
  reino: 'M10 50V28h7v-6h6v6h14v-6h6v6h7v22ZM26 50v-9a4 4 0 0 1 8 0v9Z',
  // Escudo.
  faccao: 'M30 9l18 7v14c0 10-8 17-18 22C20 47 12 40 12 30V16Z',
  // Vaso.
  cultura: 'M24 11h12c0 8 8 12 8 24c0 10-6 15-14 15s-14-5-14-15c0-12 8-16 8-24Z',
  // Estrela de cinco pontas.
  religiao: 'M30 8l6.5 13.5L51 23.5L40.5 34l2.5 15L30 42l-13 7l2.5-15L9 23.5l14.5-2Z',
  // Brilho de quatro pontas.
  magia: 'M30 8l4.5 17.5L52 30l-17.5 4.5L30 52l-4.5-17.5L8 30l17.5-4.5Z',
  // Joia.
  artefato: 'M17 19h26l9 10L30 52L8 29Z',
  // Folha.
  especie: 'M12 48C12 25 25 13 50 11c0 24-11 37-38 37ZM12 48L34 26',
  // Lâmpada.
  conceito: 'M30 9a15 15 0 0 1 8 27.700V42H22v-5.300A15 15 0 0 1 30 9ZM23 46h14v4H23Z',
  // Pergaminho.
  documento: 'M16 10h28a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4ZM20 20h20M20 28h20M20 36h13',
}
const FALLBACK = 'M30 8L52 30L30 52L8 30Z'

export function KindPortrait({ kind, name, className = '' }: { kind: string; name: string; className?: string }) {
  const letter = (name.trim()[0] ?? '?').toLocaleUpperCase('pt-BR')
  const stroke = kind === 'especie' || kind === 'documento'
  return (
    <svg
      className={`kind-portrait ${className}`.trim()}
      viewBox="0 0 60 60"
      preserveAspectRatio="xMidYMid meet"
      style={{ '--k': `var(--kind-${kind}, var(--accent))` } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      {/* O fundo passa dos 60×60: o desenho cabe inteiro (e o selo não é cortado) em qualquer moldura. */}
      <rect className="kp-bg" x="-200" y="-200" width="460" height="460" />
      <rect className="kp-shade" x="-200" y="-200" width="460" height="460" />
      <path className={`kp-art${stroke ? ' is-line' : ''}`} d={ART[kind] ?? FALLBACK} />
      <circle className="kp-chip" cx="46" cy="47" r="8" />
      <text className="kp-letter" x="46" y="47" dy="0.36em" textAnchor="middle">
        {letter}
      </text>
    </svg>
  )
}
