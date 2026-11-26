import { useRef } from 'react'

/*
 * Troca com fade: devolve um número que sobe quando os valores mudam DEPOIS da primeira vez. Usado como `key`
 * (e para ligar a classe `swap-in`) no nome, no retrato e no resumo da ficha: ao mover a régua "até onde na
 * história" ou trocar de versão, o que mudou aparece com um fade curto em vez de pular. Na abertura da ficha, nada.
 */
export function useSwap(...values: unknown[]): number {
  const sig = values.join('\u0001')
  const prev = useRef(sig)
  const count = useRef(0)
  if (prev.current !== sig) {
    prev.current = sig
    count.current += 1
  }
  return count.current
}
