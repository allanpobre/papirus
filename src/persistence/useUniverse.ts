import { useCallback, useEffect, useRef, useState } from 'react'
import type { Universe } from '../model/schema'
import type { Library, UniverseRepository } from './repository'

export type SaveStatus = 'salvo' | 'pendente' | 'salvando' | 'erro'

const AUTOSAVE_DELAY_MS = 600

/**
 * Mantém um universo aberto e salva automaticamente após uma pausa nas alterações.
 * Também salva imediatamente quando a página é escondida ou fechada.
 */
export function useUniverse(library: Library, initial: Universe, recovered: boolean) {
  const [universe, setUniverseState] = useState<Universe>(initial)
  const [status, setStatus] = useState<SaveStatus>('salvo')

  const [repo] = useState<UniverseRepository>(() => library.repository(initial.id))
  const latest = useRef<Universe>(initial)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saving = useRef<Promise<void>>(Promise.resolve())

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!dirty.current) return saving.current
    dirty.current = false
    const snapshot = latest.current
    const r = repo
    setStatus('salvando')
    saving.current = saving.current
      .then(() => r.save(snapshot))
      .then(() => library.touch(snapshot))
      .then(
        () => setStatus(dirty.current ? 'pendente' : 'salvo'),
        (err: unknown) => {
          console.error('Falha ao salvar', err)
          dirty.current = true
          setStatus('erro')
        },
      )
    return saving.current
  }, [library, repo])

  const update = useCallback(
    (change: (u: Universe) => Universe) => {
      const next = change(latest.current)
      if (next === latest.current) return
      latest.current = next
      setUniverseState(next)
      dirty.current = true
      setStatus('pendente')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  useEffect(() => {
    // Uma cópia recuperada da emergência ainda precisa chegar ao armazenamento principal.
    if (recovered) {
      dirty.current = true
      void flush()
    }
  }, [recovered, flush])

  useEffect(() => {
    // Ao sair, grava primeiro a cópia síncrona: a gravação assíncrona pode não terminar.
    const leave = () => {
      if (dirty.current) repo.saveEmergency(latest.current)
      void flush()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [flush, repo])

  return { universe, status, update, flush, repo }
}
