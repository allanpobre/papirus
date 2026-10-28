import { useEffect, useState } from 'react'

/**
 * O clima de cada setor (mesa, Oficina) vale para o app inteiro enquanto a pessoa está
 * nele. Vários lugares podem pedir ao mesmo tempo (a campanha e a tela da mesa; a Oficina
 * aberta por cima da mesa): vale o último que pediu, e ao fechar volta o de antes.
 */
type Attrs = Record<string, string>

const KEYS = ['sector', 'mesaTema', 'mesaModo', 'oficinaModo']
let stack: { id: number; attrs: Attrs }[] = []
let next = 0

function apply() {
  const b = document.body.dataset
  for (const k of KEYS) delete b[k]
  const top = stack[stack.length - 1]
  if (top) Object.assign(b, top.attrs)
}

/** Pede o clima enquanto o componente existir (`null` = não pede). */
export function useSectorClimate(attrs: Attrs | null) {
  const [id] = useState(() => ++next)
  const key = attrs ? JSON.stringify(attrs) : ''
  useEffect(() => {
    if (!key) return
    const mine = id
    const entry = stack.find((e) => e.id === mine)
    if (entry) entry.attrs = JSON.parse(key) as Attrs
    else stack.push({ id: mine, attrs: JSON.parse(key) as Attrs })
    apply()
  }, [id, key])
  useEffect(() => {
    if (key) return
    const mine = id
    if (!stack.some((e) => e.id === mine)) return
    stack = stack.filter((e) => e.id !== mine)
    apply()
  }, [id, key])
  useEffect(() => {
    const mine = id
    return () => {
      stack = stack.filter((e) => e.id !== mine)
      apply()
    }
  }, [id])
}
