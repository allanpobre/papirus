import { Timer, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { playKey, unlockAudio } from '../../editor/keySounds'
import { countWords } from '../../persistence/repository'
import { useWorkspace } from '../../state/workspace'

/**
 * Sprint de escrita: X minutos para escrever o quanto der. Continua contando se você
 * sair do Escrever; no fim, um aviso com quantas palavras saíram.
 */
interface SprintState {
  universeId: string
  endsAt: number
  minutes: number
  startWords: number
}

let current: SprintState | null = null
const listeners = new Set<() => void>()
const set = (s: SprintState | null) => {
  current = s
  for (const l of listeners) l()
}
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const OPTIONS = [10, 15, 25] as const
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function SprintButton() {
  const { universe, toast, prefs } = useWorkspace()
  const sprint = useSyncExternalStore(subscribe, () => current)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const mine = sprint && sprint.universeId === universe.id ? sprint : null
  const gained = mine ? Math.max(0, countWords(universe) - mine.startWords) : 0

  useEffect(() => {
    if (!mine) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mine])

  useEffect(() => {
    if (!mine || now < mine.endsAt) return
    set(null)
    toast(`Sprint de ${mine.minutes} min: ${gained === 1 ? '1 palavra' : `${gained.toLocaleString('pt-BR')} palavras`}.${gained >= mine.minutes * 20 ? ' Belo ritmo!' : ''}`)
    if (prefs.keySound !== 'nenhum') playKey(prefs.keySound, 'enter')
  }, [mine, now, gained, toast, prefs.keySound])

  if (mine) {
    return (
      <span className="sprint is-running" role="timer" aria-label={`Sprint: faltam ${mmss(mine.endsAt - now)}, ${gained} palavras`}>
        <Timer size={14} aria-hidden="true" /> {mmss(mine.endsAt - now)} · +{gained.toLocaleString('pt-BR')}
        <button type="button" className="btn-icon btn-xs" aria-label="Parar o sprint" title="Parar o sprint" onClick={() => set(null)}>
          <X size={12} />
        </button>
      </span>
    )
  }
  return (
    <span className="sprint">
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Timer size={14} aria-hidden="true" /> Sprint
      </button>
      {open && (
        <span className="sprint-options" role="group" aria-label="Duração do sprint">
          {OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className="btn btn-sm"
              onClick={() => {
                unlockAudio()
                setOpen(false)
                setNow(Date.now())
                set({ universeId: universe.id, endsAt: Date.now() + m * 60_000, minutes: m, startWords: countWords(universe) })
              }}
            >
              {m} min
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
