import { useEffect, useState } from 'react'

/**
 * O valor depois que ele para de mudar por `ms`. Para contas pesadas (continuidade,
 * nomes no texto) não rodarem a cada tecla: esperam a pessoa dar uma pausa.
 */
export function useSettled<T>(value: T, ms = 700): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (Object.is(value, settled)) return
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, settled, ms])
  return settled
}
