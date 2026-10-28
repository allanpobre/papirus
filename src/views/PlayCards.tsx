import { Dices, Medal as MedalIcon, PenLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CHALLENGE_WORDS, challenges, challengesDone, levelFor, MEDALS, promptOfTheDay, saveChallenge } from '../logic/play'
import { todayKey } from '../logic/stats'
import type { Scene } from '../model/schema'
import { addScene, updateScene } from '../model/universe'
import { wordCount } from '../persistence/repository'
import { totalWritten } from '../shell/usePlay'
import { wordsHistory } from '../social/dailyWords'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

const dm = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** O desafio de hoje: uma proposta por dia; com 100 palavras na cena, conta como feito. */
export function DailyChallengeCard() {
  const { universe, update, go, readOnly } = useWorkspace()
  const day = todayKey()
  const prompt = promptOfTheDay(day)
  const rec = challenges()[day]
  const here = rec && rec.universeId === universe.id ? universe.scenes.find((s) => s.id === rec.sceneId) : undefined
  const words = here ? wordCount(here.text) : 0
  const done = Boolean(rec?.done) || words >= CHALLENGE_WORDS

  const accept = () => {
    let created: Scene | undefined
    update((u) => {
      const [next, s] = addScene(u, null, `Desafio de ${dm.format(new Date())}`)
      created = s
      return updateScene(next, s.id, { synopsis: prompt })
    })
    if (!created) return
    saveChallenge(day, { universeId: universe.id, sceneId: created.id })
    go('escrever', created.id)
  }

  return (
    <section className={`home-card play-challenge${done ? ' is-done' : ''}`} aria-label="Desafio de hoje">
      <p className="eyebrow">
        <Dices size={13} aria-hidden="true" /> Desafio de hoje
      </p>
      <p className="play-prompt">{prompt}</p>
      {done ? (
        <p className="small play-done">Feito! Amanhã tem outro.</p>
      ) : here ? (
        <>
          <span className="resource-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (words / CHALLENGE_WORDS) * 100)}%` }} />
          </span>
          <button type="button" className="btn btn-sm" onClick={() => go('escrever', here.id)}>
            <PenLine size={14} /> Continuar ({words} de {CHALLENGE_WORDS} palavras)
          </button>
        </>
      ) : rec ? (
        <p className="muted small">Você aceitou o desafio de hoje em outro universo.</p>
      ) : (
        !readOnly && (
          <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
            <PenLine size={14} /> Escrever agora
          </button>
        )
      )}
      {!done && !rec && <p className="muted tiny">Uma cena nova com a proposta. {CHALLENGE_WORDS} palavras e está feito.</p>}
    </section>
  )
}

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
        <Modal title="Medalhas" size="sm" onClose={() => setOpen(false)}>
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
