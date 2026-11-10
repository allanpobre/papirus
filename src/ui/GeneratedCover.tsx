import { useId } from 'react'
import { coverLook, coverSeed } from './coverLook'

const INK = 'rgb(255 255 255 / 0.2)'

function Motif({ motif, seed }: { motif: number; seed: number }) {
  switch (motif) {
    case 0:
      // Mar: ondas na metade de baixo.
      return (
        <g fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round">
          {[38, 45, 52, 59].map((y) => (
            <path key={y} d={`M-4 ${y} q8 -5 16 0 t16 0 t16 0 t16 0 t16 0`} />
          ))}
        </g>
      )
    case 1:
      // Serra: três montes no horizonte.
      return (
        <g fill={INK}>
          <path d="M-6 62 L14 34 L30 62 Z" />
          <path d="M16 62 L38 28 L62 62 Z" opacity="0.7" />
          <path d="M40 62 L56 40 L72 62 Z" />
        </g>
      )
    case 2:
      // Astro sobre o horizonte.
      return (
        <g>
          <circle cx="43" cy="17" r="9" fill={INK} />
          <path d="M-2 47 H62" stroke={INK} strokeWidth="1.4" />
          <path d="M8 53 H52 M18 58 H42" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </g>
      )
    case 3: {
      // Céu: estrelas espalhadas, nos mesmos lugares para o mesmo nome.
      const stars = Array.from({ length: 11 }, (_, i) => {
        const a = Math.imul(seed ^ (i * 0x9e3779b1), 0x85ebca6b) >>> 0
        return { x: 4 + (a % 53), y: 4 + ((a >>> 9) % 53), r: 0.7 + ((a >>> 18) % 3) * 0.45 }
      })
      return (
        <g fill="rgb(255 255 255 / 0.34)">
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} />
          ))}
        </g>
      )
    }
    case 4:
      // Tecido: riscas em diagonal.
      return (
        <g stroke={INK} strokeWidth="5">
          {[-30, -10, 10, 30, 50].map((x) => (
            <path key={x} d={`M${x} 64 L${x + 44} -4`} />
          ))}
        </g>
      )
    default:
      // Anéis a partir de um canto, como a água depois da pedra.
      return (
        <g fill="none" stroke={INK} strokeWidth="1.4">
          {[12, 22, 32, 42, 52].map((r) => (
            <circle key={r} cx="60" cy="60" r={r} />
          ))}
        </g>
      )
  }
}

/**
 * A capa de um universo que ainda não tem imagem: uma cor e um desenho tirados do nome, com a
 * inicial por cima. `tone` troca a cor (as mesas usam a cor do tema delas).
 */
export function GeneratedCover({ name, tone, className = '' }: { name: string; tone?: string; className?: string }) {
  const id = useId()
  const seed = coverSeed(name)
  const look = coverLook(name)
  const letter = (name.trim()[0] ?? 'P').toLocaleUpperCase('pt-BR')
  return (
    <svg className={`gen-cover ${className}`.trim()} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect width="60" height="60" fill={tone ?? look.tone} />
      <Motif motif={look.motif} seed={seed} />
      <rect width="60" height="60" fill={`url(#${id})`} />
      <text x="30" y="30" dy="0.36em" textAnchor="middle" className="gen-cover-letter">
        {letter}
      </text>
    </svg>
  )
}
