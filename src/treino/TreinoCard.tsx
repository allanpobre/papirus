import { Check, Flame, History, Play, Timer, Trophy } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { promptOfTheDay } from '../logic/play'
import { todayKey } from '../logic/stats'
import { hasDraft, TreinoPage, type TreinoStart } from './TreinoPage'
import { TreinoHistory } from './TreinoHistory'
import { TreinoPlacar } from './TreinoPlacar'
import { scoreOf, treinoStreak, unitLabel, useTreinos, type Treino } from './treino'
import { syncTreinosNow, useTreinoSync } from './useTreinoSync'

/**
 * O treino de hoje: a proposta do dia num sprint com tempo e mínimo. Fica no início do
 * app (setor Escrita) e no Início de cada universo; dentro de um universo, o texto pode virar cena.
 */
export function TreinoCard({ onKeepScene, onAccount, compact = false }: { onKeepScene?: (t: Treino) => void; onAccount?: () => void; compact?: boolean }) {
  const list = useTreinos()
  const cloud = useTreinoSync()
  const [running, setRunning] = useState<TreinoStart | null>(null)
  const [history, setHistory] = useState(false)
  const [placar, setPlacar] = useState(false)
  const day = todayKey()
  const prompt = promptOfTheDay(day)
  const today = list.filter((t) => t.day === day && t.daily && t.prompt === prompt)
  const best = today.reduce<Treino | undefined>((b, t) => (!b || (t.done && !b.done) || scoreOf(t) > scoreOf(b) ? t : b), undefined)
  const streak = treinoStreak(list, day)
  const draft = hasDraft()
  const sync = () => syncTreinosNow(cloud.account)

  return (
    <section className={`home-card treino-card${best?.done ? ' is-done' : ''}${compact ? ' is-compact' : ''}`} aria-label="Treino de hoje">
      <p className="eyebrow">
        <Timer size={13} aria-hidden="true" /> Treino de hoje
        {streak > 0 && (
          <span className="treino-streak">
            <Flame size={12} aria-hidden="true" /> {streak} {streak === 1 ? 'dia' : 'dias'}
          </span>
        )}
      </p>
      <p className="play-prompt">{prompt}</p>
      {best && (
        <p className={`small treino-today${best.done ? ' is-done' : ''}`}>
          {best.done && <Check size={14} aria-hidden="true" />} {best.done ? 'Feito' : 'Tentado'} hoje: {scoreOf(best).toLocaleString('pt-BR')} {unitLabel(best.unit, scoreOf(best))}
          {best.minutes ? ` em ${best.minutes} min` : ''}
        </p>
      )}
      <div className="treino-card-actions">
        <button type="button" className={`btn btn-sm${best?.done ? '' : ' btn-primary'}`} onClick={() => setRunning({ prompt, daily: true })}>
          <Play size={14} /> {draft ? 'Continuar o treino' : best ? 'Treinar de novo' : 'Começar o treino'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistory(true)}>
          <History size={14} /> Seus treinos{list.length ? ` (${list.length})` : ''}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPlacar(true)}>
          <Trophy size={14} /> Placar
        </button>
      </div>
      {!best && <p className="muted tiny">Sprint com tempo e um mínimo de palavras ou caracteres. Cada tentativa fica guardada para refazer depois.</p>}

      {running && (
        <TreinoPage
          start={running}
          onClose={() => setRunning(null)}
          onSaved={sync}
          onKeepScene={onKeepScene}
          onHistory={() => {
            setRunning(null)
            setHistory(true)
          }}
        />
      )}
      {/* Fora do cartão: a janela não pode herdar a animação de entrada dele. */}
      {history &&
        createPortal(
          <TreinoHistory
            cloud={cloud}
            onClose={() => setHistory(false)}
            onDeleted={sync}
            onRedo={(t) => {
              setHistory(false)
              setRunning({ prompt: t.prompt, daily: t.prompt === prompt, setup: { minutes: t.minutes, target: t.target, unit: t.unit } })
            }}
          />,
          document.body,
        )}
      {placar &&
        createPortal(
          <TreinoPlacar
            onClose={() => setPlacar(false)}
            onAccount={
              onAccount &&
              (() => {
                setPlacar(false)
                onAccount()
              })
            }
          />,
          document.body,
        )}
    </section>
  )
}
