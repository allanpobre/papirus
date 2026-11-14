import { lazy, Suspense } from 'react'
import type { ServerConfig } from '../share/server'

// O celular do jogador só é baixado por quem abre o link da mesa.
const PlayerApp = lazy(() => import('./PlayerApp.tsx'))

/** O celular do jogador (`?mesa=`), carregado só quando o link pede. */
export function PlayerLoader({ id, server }: { id: string; server: ServerConfig | null }) {
  return (
    <Suspense fallback={null}>
      <PlayerApp id={id} server={server} />
    </Suspense>
  )
}
