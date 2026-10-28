import { Medal as MedalIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { challengesDone, levelFor, MEDALS } from '../logic/play'
import { totalWritten } from '../shell/usePlay'
import { wordsHistory } from '../social/dailyWords'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/** Nível de escritor e medalhas (dentro do cartão "Hoje"; os dias seguidos ficam no calendário). */
export function ProgressSection() {
  const { universe, library } = useWorkspace()
  const [total, setTotal] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let off = false
    void totalWritten(library, universe).then((n) => !off && setTotal(n))
    return () => {
      off = true
    }
  }, [library, universe])
  if (total === null) return null
  const level = levelFor(total)
  const stats = { totalWords: total, history: wordsHistory(), goal: universe.settings.dailyWordGoal, challengesDone: challengesDone(), entities: universe.entities.length }
  const got = MEDALS.filter((m) => m.got(stats))
  const pct = level.to ? ((total - level.from) / (level.to - level.from)) * 100 : 100

  return (
    <div className="play-progress" role="group" aria-label="Seu progresso">
      <div className="play-level">
        <span className="play-level-n" aria-hidden="true">
          {level.n}
        </span>
        <span>
          <strong>{level.name}</strong>
          <span className="muted small"> · nível {level.n}</span>
          <br />
          <span className="muted small tabular">
            {total.toLocaleString('pt-BR')} palavras{level.to ? ` · faltam ${(level.to - total).toLocaleString('pt-BR')} para o próximo` : ''}
          </span>
        </span>
      </div>
      <span className="resource-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <button type="button" className="play-medals" onClick={() => setOpen(true)} aria-label={`Medalhas: ${got.length} de ${MEDALS.length}. Ver todas`}>
        <span className="play-medals-row" aria-hidden="true">
          {got.length ? got.slice(-6).map((m) => <span key={m.id}>{m.emoji}</span>) : <MedalIcon size={16} />}
        </span>
        <span className="small">
          {got.length} de {MEDALS.length} medalhas
        </span>
      </button>
      {open && (
        <Modal title="Medalhas" size="sm" onClose={() => setOpen(false)} help="medalhas">
          <ul className="play-medal-list">
            {MEDALS.map((m) => {
              const has = got.includes(m)
              return (
                <li key={m.id} className={has ? 'is-got' : ''}>
                  <span className="play-medal-emoji" aria-hidden="true">
                    {has ? m.emoji : '🔒'}
                  </span>
                  <span>
                    <strong>{m.name}</strong>
                    <span className="muted small">{m.how}</span>
                  </span>
                  <span className="sr-only">{has ? 'conquistada' : 'ainda não'}</span>
                </li>
              )
            })}
          </ul>
        </Modal>
      )}
    </div>
  )
}
