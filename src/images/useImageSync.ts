import { useEffect, useMemo, useRef } from 'react'
import { authClient } from '../account/auth'
import type { Universe } from '../model/schema'
import type { ServerConfig } from '../share/server'
import { useSettled } from '../ui/useSettled'
import { ImageCloudError, uploadImage } from './cloud'
import { applyMoved, moveInlineMaps } from './inline'
import { imageIdsIn } from './ref'
import { setImageServer } from './resolve'
import { loadImage } from './store'

const sentKey = (server: ServerConfig) => `papirus:imagens-enviadas:${server.url}`

/** Imagens que este navegador já sabe que estão no servidor. */
export function sentImages(server: ServerConfig): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(sentKey(server)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markSent(server: ServerConfig, ids: Iterable<string>, sent = true) {
  const all = sentImages(server)
  for (const id of ids) {
    if (sent) all.add(id)
    else all.delete(id)
  }
  try {
    localStorage.setItem(sentKey(server), JSON.stringify([...all]))
  } catch {
    // Sem armazenamento: confere de novo da próxima vez (o servidor diz "já existe").
  }
}

/**
 * Com conta: as imagens do universo sobem para o servidor sozinhas, para aparecerem
 * nos outros aparelhos e para quem lê pelo link. Sem conta, ficam só neste navegador.
 */
export function useImageSync({
  universe,
  server,
  userId,
  canUpload,
  onError,
  update,
}: {
  universe: Universe
  /** De onde as imagens vêm (o servidor da conta, ou o do link de leitura). */
  server: ServerConfig | null
  userId: string | null
  canUpload: boolean
  onError: (message: string) => void
  /** Para tirar de dentro do universo as imagens de mapas antigos (só quem pode mudar o universo). */
  update?: (change: (u: Universe) => Universe) => void
}) {
  // Uma vez por universo aberto: mapas antigos com a imagem embutida passam a ser imagens à parte.
  const movedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!update || !canUpload || movedFor.current === universe.id) return
    movedFor.current = universe.id
    if (!universe.maps.some((m) => m.image.startsWith('data:'))) return
    void moveInlineMaps(universe).then((moved) => {
      if (moved.size) update((u) => applyMoved(u, moved))
    })
  }, [universe, update, canUpload])

  useEffect(() => {
    setImageServer(server)
  }, [server])

  const settled = useSettled(universe, 2000)
  const ids = useMemo(() => [...imageIdsIn(settled)].sort().join(','), [settled])
  const warned = useRef(false)
  const errorRef = useRef(onError)
  useEffect(() => {
    errorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!canUpload || !server || !userId || !ids) return
    const missing = ids.split(',').filter((id) => !sentImages(server).has(id))
    if (!missing.length) return
    let off = false
    void (async () => {
      const sb = await authClient(server)
      for (const id of missing) {
        if (off) return
        const img = await loadImage(id)
        if (!img) continue
        try {
          await uploadImage(sb, id, img.blob)
          markSent(server, [id])
        } catch (err) {
          if (err instanceof ImageCloudError && err.reason !== 'outro' && !warned.current) {
            warned.current = true
            errorRef.current(err.message)
          }
          return
        }
      }
    })()
    return () => {
      off = true
    }
  }, [ids, server, userId, canUpload])
}
