import { useEffect, useRef, useState } from 'react'

const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * O d20 que gira: passa alguns números e para no que saiu, como o da apresentação.
 * Gira ao aparecer (com `fresh`) e sempre que o valor muda. Sem valor, espera com um "?".
 * O texto é sempre o valor de verdade (leitores de tela e testes não veem os números girando).
 */
export function RollingDie({ value, fresh = false, className = '', label }: { value: number | null; fresh?: boolean; className?: string; label?: string }) {
  const [spin, setSpin] = useState<number | null>(null)
  const first = useRef(true)

  useEffect(() => {
    const mount = first.current
    first.current = false
    if (value === null || (mount && !fresh) || calm()) return
    let n = 0
    setSpin(1 + Math.floor(Math.random() * 20))
    const t = setInterval(() => {
      n += 1
      if (n >= 8) {
        clearInterval(t)
        setSpin(null)
      } else setSpin(1 + Math.floor(Math.random() * 20))
    }, 85)
    return () => clearInterval(t)
  }, [value, fresh])

  return (
    <span
      className={`d20${spin !== null ? ' is-rolling' : ''}${value === null ? ' is-waiting' : ''} ${className}`.trim()}
      data-spin={spin ?? undefined}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {value ?? '?'}
    </span>
  )
}
