import { useCallback, useEffect, useRef, useState } from 'react'
import { createUniverse } from '../model/universe'
import type { Universe } from '../model/schema'
import { UniverseRepository } from './repository'
import { openBestStore, requestPersistentStorage, type KeyValueStore } from './storage'

export type SaveStatus = 'carregando' | 'salvo' | 'pendente' | 'salvando' | 'erro'

const AUTOSAVE_DELAY_MS = 600

/**
 * Carrega o universo local e salva automaticamente após uma pausa nas alterações.
 * Também salva imediatamente quando a página é escondida ou fechada.
 */
export function useUniverse() {
  const [universe, setUniverseState] = useState<Universe | null>(null)
  const [status, setStatus] = useState<SaveStatus>('carregando')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [storeKind, setStoreKind] = useState<KeyValueStore['kind'] | null>(null)

  const repo = useRef<UniverseRepository | null>(null)
  const latest = useRef<Universe | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saving = useRef<Promise<void>>(Promise.resolve())

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!dirty.current || !repo.current || !latest.current) return saving.current
    dirty.current = false
    const snapshot = latest.current
    const r = repo.current
    setStatus('salvando')
    saving.current = saving.current
      .then(() => r.save(snapshot))
      .then(
        () => setStatus(dirty.current ? 'pendente' : 'salvo'),
        (err: unknown) => {
          console.error('Falha ao salvar', err)
          dirty.current = true
          setStatus('erro')
        },
      )
    return saving.current
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const store = await openBestStore()
      const r = new UniverseRepository(store, safeLocalStorage())
      setStoreKind(store.kind)
      try {
        const loaded = (await r.load()) ?? createUniverse()
        if (cancelled) return
        repo.current = r
        latest.current = loaded
        setUniverseState(loaded)
        setStatus('salvo')
        if (r.recoveredFromEmergency) {
          dirty.current = true
          void flush()
        }
        void requestPersistentStorage()
      } catch (err) {
        // Nunca sobrescreve dados que não conseguimos ler.
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
          setStatus('erro')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [flush])

  useEffect(() => {
    // Ao sair, grava primeiro a cópia síncrona: a gravação assíncrona pode não terminar.
    const leave = () => {
      if (dirty.current && latest.current) repo.current?.saveEmergency(latest.current)
      void flush()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    const onPageHide = leave
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flush])

  const update = useCallback(
    (change: (u: Universe) => Universe) => {
      if (!latest.current) return
      latest.current = change(latest.current)
      setUniverseState(latest.current)
      dirty.current = true
      setStatus('pendente')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  return {
    universe,
    status,
    loadError,
    storeKind,
    update,
    flush,
    toFile: (u: Universe) => repo.current!.toFile(u),
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
