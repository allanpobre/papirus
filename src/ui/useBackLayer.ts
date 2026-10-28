import { useEffect, useLayoutEffect, useRef } from 'react'
import { openLayer } from '../shell/backStack'

/**
 * Enquanto `active`, a janela (ou painel) ocupa um passo do histórico: o "voltar" do
 * aparelho a fecha chamando `onClose`, em vez de sair da tela ou do app.
 */
export function useBackLayer(onClose: () => void, active = true) {
  const close = useRef(onClose)
  useLayoutEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!active) return
    return openLayer(() => close.current())
  }, [active])
}
