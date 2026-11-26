import { useEffect, useRef, useState } from 'react'

/** Um número que sobe até o valor quando a tela abre (só na primeira vez; depois acompanha direto). Sem movimento se o aparelho pedir. */
export function CountUp({ value, ms = 700 }: { value: number; ms?: number }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(reduce ? value : 0)
  const first = useRef(true)
  useEffect(() => {
    if (reduce || !first.current || value <= 0) {
      first.current = false
      setShown(value)
      return
    }
    first.current = false
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, reduce])
  return <>{shown.toLocaleString('pt-BR')}</>
}
