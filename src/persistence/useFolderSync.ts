import { useCallback, useEffect, useRef, useState } from 'react'
import type { Universe } from '../model/schema'
import { hasPermission, pickFolder, recallFolder, rememberFolder, supportsFolders, writeUniverseToFolder, type DirHandle } from './folder'
import type { Library, UniverseRepository } from './repository'
import type { SaveStatus } from './useUniverse'

export interface FolderSync {
  supported: boolean
  /** Nome da pasta escolhida, se houver. */
  name: string | null
  /** `pendente`: a pasta existe, mas o navegador pede permissão de novo (clique em "Reconectar"). */
  state: 'sem-pasta' | 'pendente' | 'ok' | 'escrevendo' | 'erro'
  lastSync: string | null
  error: string | null
  connect: () => Promise<void>
  reconnect: () => Promise<void>
  disconnect: () => Promise<void>
  syncNow: () => Promise<void>
}

const SYNC_DELAY_MS = 2500

/**
 * Mantém uma cópia do universo numa pasta do computador, atualizada depois de
 * cada salvamento. A cópia no navegador continua sendo a principal.
 */
export function useFolderSync(library: Library, repo: UniverseRepository, universe: Universe, status: SaveStatus): FolderSync {
  const [handle, setHandle] = useState<DirHandle | null>(null)
  const [state, setState] = useState<FolderSync['state']>('sem-pasta')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(universe)
  latest.current = universe
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const writing = useRef(false)

  useEffect(() => {
    if (!supportsFolders()) return
    let cancelled = false
    void recallFolder(library.store, universe.id).then(async (h) => {
      if (!h || cancelled) return
      setHandle(h)
      setState((await hasPermission(h)) ? 'ok' : 'pendente')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, universe.id])

  const write = useCallback(
    async (h: DirHandle) => {
      if (writing.current) return
      writing.current = true
      setState('escrevendo')
      try {
        await writeUniverseToFolder(h, latest.current, repo.toFile(latest.current))
        setLastSync(new Date().toISOString())
        setError(null)
        setState('ok')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setState('erro')
      } finally {
        writing.current = false
      }
    },
    [repo],
  )

  // Depois de cada salvamento, atualiza a pasta (com uma pausa, para juntar mudanças).
  useEffect(() => {
    if (!handle || status !== 'salvo' || (state !== 'ok' && state !== 'erro')) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void write(handle), SYNC_DELAY_MS)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe, status, handle])

  const connect = useCallback(async () => {
    try {
      const h = await pickFolder()
      await rememberFolder(library.store, universe.id, h)
      setHandle(h)
      setState('ok')
      await write(h)
    } catch (err) {
      // Cancelar a escolha não é erro.
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
      setState('erro')
    }
  }, [library, universe.id, write])

  const reconnect = useCallback(async () => {
    if (!handle) return
    if (await hasPermission(handle, true)) {
      setState('ok')
      await write(handle)
    }
  }, [handle, write])

  const disconnect = useCallback(async () => {
    await rememberFolder(library.store, universe.id, null)
    setHandle(null)
    setState('sem-pasta')
    setLastSync(null)
  }, [library, universe.id])

  const syncNow = useCallback(async () => {
    if (handle) await write(handle)
  }, [handle, write])

  return { supported: supportsFolders(), name: handle?.name ?? null, state, lastSync, error, connect, reconnect, disconnect, syncNow }
}
