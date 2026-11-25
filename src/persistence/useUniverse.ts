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
  // O que deu errado na última gravação: falta de espaço no aparelho tem saída diferente.
  const [saveError, setSaveError] = useState<'espaco' | 'outro' | null>(null)

  const [repo] = useState<UniverseRepository>(() => library.repository(initial.id))
  const latest = useRef<Universe>(initial)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saving = useRef<Promise<void>>(Promise.resolve())
  // Parada porque outra aba abriu o mesmo universo (ver abaixo). Em ref: quem guardou a função de mudar antes
  // de parar (o editor aberto) também não escreve por cima.
  const parkedRef = useRef(false)

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
        () => {
          setSaveError(null)
          setStatus(dirty.current ? 'pendente' : 'salvo')
        },
        (err: unknown) => {
          console.error('Falha ao salvar', err)
          dirty.current = true
          setSaveError(isQuotaError(err) ? 'espaco' : 'outro')
          setStatus('erro')
          // Tenta de novo daqui a pouco (o espaço pode ter sido liberado).
          clearTimeout(timer.current)
          timer.current = setTimeout(() => void flush(), 5000)
        },
      )
    return saving.current
  }, [library, repo])

  const update = useCallback(
    (change: (u: Universe) => Universe) => {
      if (parkedRef.current) return
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

  // Duas abas com o mesmo universo: a última a abrir (ou a tocar em "Continuar aqui") fica com ele. A outra
  // grava o que tinha, avisa que soltou e fica parada (só leitura) até a pessoa pedir de volta; ao voltar,
  // relê o que a outra aba salvou. Sem isso, as duas diziam "Salvo" e a última a salvar apagava a outra.
  const [parked, setParked] = useState(false)
  // Conta as releituras (o que a outra aba salvou): o editor da cena recomeça com o texto novo.
  const [reloads, setReloads] = useState(0)
  const channel = useRef<BroadcastChannel | null>(null)
  const tabId = useRef(Math.random().toString(36).slice(2))
  const reload = useCallback(async () => {
    const fresh = await repo.load()
    if (fresh && fresh.id === latest.current.id) {
      latest.current = fresh
      setUniverseState(fresh)
      setReloads((n) => n + 1)
    }
  }, [repo])
  const claim = useCallback(() => {
    channel.current?.postMessage({ t: 'claim', id: initial.id, tab: tabId.current })
  }, [initial.id])
  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return
    const ch = new BroadcastChannel('papirus-universos')
    channel.current = ch
    ch.onmessage = (ev: MessageEvent<{ t: string; id: string; tab: string; to?: string }>) => {
      const m = ev.data
      if (!m || m.id !== initial.id || m.tab === tabId.current) return
      if (m.t === 'claim') {
        // Outra aba quer este universo: grava o que falta e solta.
        parkedRef.current = true
        setParked(true)
        void flush().then(() => ch.postMessage({ t: 'released', id: initial.id, tab: tabId.current, to: m.tab }))
      } else if (m.t === 'released' && m.to === tabId.current) {
        // A outra aba acabou de gravar: pega a versão dela (o que mudou aqui enquanto parada não conta).
        clearTimeout(timer.current)
        dirty.current = false
        void reload()
      }
    }
    claim()
    return () => {
      ch.close()
      channel.current = null
    }
  }, [initial.id, flush, reload, claim])
  const resume = useCallback(() => {
    parkedRef.current = false
    setParked(false)
    claim()
  }, [claim])
  const guarded = useCallback((change: (u: Universe) => Universe) => (parkedRef.current ? undefined : update(change)), [update])

  return { universe, status, saveError, update: guarded, flush, repo, parked, resume, reloads }
}

/** O navegador recusou por falta de espaço (cada navegador diz de um jeito). */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota|espa[cç]o/i.test(e.message ?? ''))
}
