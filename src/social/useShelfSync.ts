import { useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { shelf } from '../export/shelf'
import { DEFAULT_PUBLIC_URL } from '../share/server'
import { getShare, readLink } from '../share/sharing'
import { useWorkspace } from '../state/workspace'
import { isLocalOnly } from '../model/sample'
import { syncShelf } from './social'

export type ShelfSyncState = { state: 'parado' } | { state: 'enviando' } | { state: 'ok'; shown: number } | { state: 'erro'; error: string }

/**
 * Mantém a estante do perfil igual aos livros deste universo (só do dono, com conta).
 * Espera um pouco depois da última mudança para não mandar a cada tecla.
 */
export function useShelfSync(): ShelfSyncState {
  const { universe, source, prefs } = useWorkspace()
  const { user, server } = useAccount()
  const [status, setStatus] = useState<ShelfSyncState>({ state: 'parado' })
  const mine = source.kind === 'proprio' && !isLocalOnly(universe)
  const userId = user?.id
  // Nada à mostra e nada para tirar: não precisa nem falar com o servidor.
  const anyVisible = shelf(universe).some((b) => b.shelfVisibility !== 'privado')
  const [touched, setTouched] = useState(false)
  if (anyVisible && !touched) setTouched(true)

  useEffect(() => {
    if (!mine || !userId || !server || !touched) return
    let off = false
    const timer = setTimeout(() => {
      void (async () => {
        if (off) return
        setStatus({ state: 'enviando' })
        try {
          const sb = await authClient(server)
          // Se o universo tem link de leitura, quem vê a estante pode abrir o livro.
          const share = await getShare(sb, userId, universe.id).catch(() => null)
          const link = share?.link_token ? readLink(prefs.publicUrl || DEFAULT_PUBLIC_URL, server, share.link_token, 'livro') : null
          const shown = await syncShelf(sb, userId, universe, link)
          if (!off) setStatus({ state: 'ok', shown })
        } catch (err) {
          if (!off) setStatus({ state: 'erro', error: err instanceof Error ? err.message : String(err) })
        }
      })()
    }, 1500)
    return () => {
      off = true
      clearTimeout(timer)
    }
  }, [mine, userId, server, touched, universe, prefs.publicUrl])

  return status
}
