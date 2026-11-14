import { lazy, Suspense, useEffect, useState } from 'react'
import { onBookReplace, type ReplaceRequest } from './replaceEvents'

// A janela (e o motor de procurar e trocar) só é baixada na primeira vez que alguém pede.
const ReplaceDialog = lazy(() => import('./ReplaceDialog').then((m) => ({ default: m.ReplaceDialog })))

/** Fica na área de trabalho e abre a janela quando alguém pede (barra da cena, Ctrl+K, ficha renomeada). */
export function ReplaceHost() {
  const [request, setRequest] = useState<ReplaceRequest | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(
    () =>
      onBookReplace((r) => {
        setRequest(r)
        setNonce((n) => n + 1)
      }),
    [],
  )
  return request ? (
    <Suspense fallback={null}>
      <ReplaceDialog key={nonce} initial={request} onClose={() => setRequest(null)} />
    </Suspense>
  ) : null
}
