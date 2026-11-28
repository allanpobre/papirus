/**
 * O mundo no tamanho que ele tem: uma ilustração em traço fino (como gravura) para cada nível do mundo, de Semente
 * a Lenda. Usa as cores do tema (currentColor e --accent), então segue o clima de cada mundo e o modo escuro.
 * Melhor que um escudo com número: o progresso é o próprio mundo crescendo.
 */
export function WorldStage({ level, className = '' }: { level: number; className?: string }) {
  const n = Math.max(1, Math.min(7, level))
  return (
    <svg className={`world-stage ${className}`.trim()} viewBox="14 4 132 60" role="img" aria-label={STAGE_LABEL[n - 1]} focusable="false">
      {/* O chão, que vai ficando mais largo conforme o mundo cresce. */}
      <path d={`M${80 - n * 10} 58 Q80 ${60 - n} ${80 + n * 10} 58`} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {n === 1 && <Sprout x={80} />}
      {n >= 2 && <Houses count={Math.min(n, 4) + 1} />}
      {n >= 3 && <Wall />}
      {n >= 4 && <Castle x={80} />}
      {n >= 5 && (
        <>
          <Castle x={36} small />
          <Castle x={124} small />
          <path d="M44 58 L72 58 M88 58 L116 58" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" />
        </>
      )}
      {n >= 6 && <path d="M8 62 Q30 52 52 60 T100 60 T152 58" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.8" />}
      {n >= 7 && <Stars />}
    </svg>
  )
}

const STAGE_LABEL = ['Uma semente', 'Um vilarejo', 'Uma cidade murada', 'Um reino com castelo', 'Um império de castelos', 'Um continente', 'Uma lenda sob as estrelas']

function Sprout({ x }: { x: number }) {
  return (
    <g fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round">
      <path d={`M${x} 58 V44`} />
      <path d={`M${x} 48 Q${x - 9} 46 ${x - 10} 38 Q${x - 2} 39 ${x} 48`} fill="var(--accent)" fillOpacity="0.15" />
      <path d={`M${x} 45 Q${x + 9} 42 ${x + 11} 34 Q${x + 2} 35 ${x} 45`} fill="var(--accent)" fillOpacity="0.15" />
    </g>
  )
}

function House({ x, h = 8 }: { x: number; h?: number }) {
  return <path d={`M${x - 5} 58 V${58 - h} L${x} ${53 - h} L${x + 5} ${58 - h} V58 Z`} fill="var(--accent)" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
}

function Houses({ count }: { count: number }) {
  const xs = [64, 96, 54, 106, 46, 114].slice(0, count)
  return (
    <g>
      {xs.map((x, i) => (
        <House key={x} x={x} h={8 + (i % 3) * 3} />
      ))}
    </g>
  )
}

function Wall() {
  return <path d="M28 58 V48 h3 v-2 h3 v2 h3 v-2 h3 v2 V58 M120 58 V48 h3 v-2 h3 v2 h3 v-2 h3 v2 V58" fill="var(--accent)" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
}

function Castle({ x, small = false }: { x: number; small?: boolean }) {
  const s = small ? 0.65 : 1
  const t = (v: number) => v * s
  const base = 58
  return (
    <g fill="var(--accent)" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
      <path d={`M${x - t(12)} ${base} V${base - t(16)} h${t(4)} v${t(-3)} h${t(3)} v${t(3)} h${t(10)} v${t(-3)} h${t(3)} v${t(3)} h${t(4)} V${base} Z`} />
      <path d={`M${x - t(4)} ${base - t(16)} V${base - t(30)} L${x} ${base - t(36)} L${x + t(4)} ${base - t(30)} V${base - t(16)}`} />
      <path d={`M${x} ${base - t(36)} V${base - t(42)} l${t(5)} ${t(2)} l${t(-5)} ${t(2)}`} fill="var(--accent)" fillOpacity="0.6" stroke="var(--accent)" />
      <path d={`M${x - t(2)} ${base} V${base - t(6)} a${t(2)} ${t(2)} 0 0 1 ${t(4)} 0 V${base}`} fill="none" />
    </g>
  )
}

function Stars() {
  const pts: [number, number][] = [
    [22, 14],
    [48, 8],
    [80, 5],
    [112, 9],
    [138, 16],
    [64, 18],
    [98, 20],
  ]
  return (
    <g>
      <path d={`M${pts.slice(0, 5).map(([x, y]) => `${x} ${y}`).join(' L')}`} fill="none" stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="0.6" />
      {pts.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="var(--accent)" />
      ))}
    </g>
  )
}
