import { Check, CloudOff, HardDrive, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SaveStatus } from '../persistence/useUniverse'

/*
 * No celular, o "Salvo" do menu lateral não existe. Este selo pequeno, acima da barra de baixo, diz o que importa
 * sem ficar no caminho: "Salvo" por um instante depois de salvar, "Salvando…" se demorar, e — esses ficam até
 * resolver — "Sem espaço neste aparelho" (com o que fazer), "Não consegui salvar" e "Sem internet".
 */

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function MobileSaveStatus({ status, saveError, cloud, onFreeSpace }: { status: SaveStatus; saveError: 'espaco' | 'outro' | null; cloud: boolean; onFreeSpace: () => void }) {
  const online = useOnline()
  // "Salvo" aparece só um instante, logo depois de uma gravação; "Salvando…" só se passar de um segundo.
  const [flash, setFlash] = useState(false)
  const [slow, setSlow] = useState(false)
  const was = useRef(status)
  useEffect(() => {
    const before = was.current
    was.current = status
    if (status === 'salvo' && before !== 'salvo') {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1600)
      return () => clearTimeout(t)
    }
    if (status === 'salvando' || status === 'pendente') {
      const t = setTimeout(() => setSlow(true), 1200)
      return () => {
        clearTimeout(t)
        setSlow(false)
      }
    }
  }, [status])

  let body: React.ReactNode = null
  let tone = 'ok'
  if (status === 'erro' && saveError === 'espaco') {
    tone = 'erro'
    body = (
      <>
        <HardDrive size={14} aria-hidden="true" /> Sem espaço neste aparelho: o que mudou ainda não foi salvo.{' '}
        <button type="button" className="link-btn" onClick={onFreeSpace}>
          Liberar espaço
        </button>
      </>
    )
  } else if (status === 'erro') {
    tone = 'erro'
    body = (
      <>
        <TriangleAlert size={14} aria-hidden="true" /> Não consegui salvar. Tentando de novo…
      </>
    )
  } else if (!online && cloud) {
    tone = 'aviso'
    body = (
      <>
        <CloudOff size={14} aria-hidden="true" /> Sem internet · salvo neste aparelho
      </>
    )
  } else if ((status === 'salvando' || status === 'pendente') && slow) {
    body = (
      <>
        <Loader2 size={14} className="spin" aria-hidden="true" /> Salvando…
      </>
    )
  } else if (flash) {
    body = (
      <>
        <Check size={14} aria-hidden="true" /> Salvo
      </>
    )
  }
  return (
    <div className={`mobile-save is-${tone}${body ? ' is-shown' : ''}`} role="status" aria-live="polite" data-tour="salvo">
      {body}
    </div>
  )
}
