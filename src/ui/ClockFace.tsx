/**
 * Um relógio de progresso desenhado: um círculo cortado em fatias, as cheias na cor de destaque.
 * O nome e o "2 de 4" ficam no texto ao lado; o desenho é só para os olhos.
 */
export function ClockFace({ size, filled, className = '' }: { size: number; filled: number; className?: string }) {
  const r = 14
  const slice = (i: number) => {
    const a0 = (i / size) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / size) * 2 * Math.PI - Math.PI / 2
    const x0 = 16 + r * Math.cos(a0)
    const y0 = 16 + r * Math.sin(a0)
    const x1 = 16 + r * Math.cos(a1)
    const y1 = 16 + r * Math.sin(a1)
    return `M16 16 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
  }
  return (
    <svg className={`clock-face ${className}`.trim()} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={r} className="clock-face-bg" />
      {Array.from({ length: size }, (_, i) => (
        <path key={i} d={slice(i)} className={i < filled ? 'clock-face-on' : 'clock-face-off'} />
      ))}
    </svg>
  )
}
