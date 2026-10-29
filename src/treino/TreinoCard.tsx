import { Check, Dices, Flame, GraduationCap, History, Play, Timer, Trophy } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { promptOfTheDay } from '../logic/play'
import { useOficinaProgress } from '../oficina/progress'
import { StepPage } from '../oficina/StepPage'
import { todayStep, type Trail, type TrailStep } from '../oficina/trails'
import { todayKey } from '../logic/stats'
import { hasDraft, TreinoPage, type TreinoStart } from './TreinoPage'
import { TreinoHistory } from './TreinoHistory'
import { TreinoPlacar } from './TreinoPlacar'
import { scoreOf, treinoStreak, unitLabel, useTreinos, type Treino } from './treino'
import { syncTreinosNow, useTreinoSync } from './useTreinoSync'

/**
 * O treino de hoje: com uma trilha escolhida na Oficina, o próximo passo dela; sem trilha,
 * a proposta do dia num sprint com tempo e mínimo. Fica no início do app (setor Escrita) e
 * no Início de cada universo; dentro de um universo, o texto pode virar cena.
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
  const progress = useOficinaProgress()
  const trail = progress.asked ? todayStep(progress) : null
  const [step, setStep] = useState<{ trail: Trail; step: TrailStep } | null>(null)

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
      {trail ? (
        <>
          <p className="treino-trail-kicker small">
            <GraduationCap size={14} aria-hidden="true" /> Oficina · {trail.trail.guide.label} · passo {trail.trail.steps.indexOf(trail.step) + 1} de {trail.trail.steps.length}
          </p>
          <p className="play-prompt">{trail.step.title}</p>
        </>
      ) : (
        <p className="play-prompt">{prompt}</p>
      )}
      {best && (
        <p className={`small treino-today${best.done ? ' is-done' : ''}`}>
          {best.done && <Check size={14} aria-hidden="true" />} {best.done ? 'Feito' : 'Tentado'} hoje: {scoreOf(best).toLocaleString('pt-BR')} {unitLabel(best.unit, scoreOf(best))}
          {best.minutes ? ` em ${best.minutes} min` : ''}
        </p>
      )}
      <div className="treino-card-actions">
        {trail && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setStep(trail)}>
            <Play size={14} /> Fazer o passo
          </button>
        )}
        <button type="button" className={`btn btn-sm${best?.done || trail ? (trail ? ' btn-ghost' : '') : ' btn-primary'}`} onClick={() => setRunning({ prompt, daily: true })}>
          {trail ? <Dices size={14} /> : <Play size={14} />} {draft ? 'Continuar o treino' : trail ? 'Proposta sorteada' : best ? 'Treinar de novo' : 'Começar o treino'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistory(true)}>
          <History size={14} /> Seus treinos{list.length ? ` (${list.length})` : ''}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPlacar(true)}>
          <Trophy size={14} /> Placar
        </button>
      </div>
      {!best && <p className="muted tiny">Sprint com tempo e um mínimo de palavras ou caracteres. Cada tentativa fica guardada para refazer depois.</p>}

      {step && (
        <StepPage
          key={`${step.trail.id}:${step.step.id}`}
          trail={step.trail}
          step={step.step}
          onClose={() => setStep(null)}
          onNext={(next) => setStep({ trail: step.trail, step: next })}
          onKeepScene={onKeepScene}
        />
      )}
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
