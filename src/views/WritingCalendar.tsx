import { useMemo } from 'react'
import { deadlinePlan } from '../logic/deadline'
import { wordsByDay } from '../logic/stats'
import type { Universe } from '../model/schema'

const WEEKS = 16
const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

/** Dias seguidos escrevendo, terminando hoje (ou ontem, se hoje ainda não teve nada). */
export function currentStreak(days: { words: number }[]): number {
  let i = days.length - 1
  if (i >= 0 && days[i].words === 0) i--
  let n = 0
  for (; i >= 0 && days[i].words > 0; i--) n++
  return n
}

function bestStreak(days: { words: number }[]): number {
  let best = 0
  let run = 0
  for (const d of days) {
    run = d.words > 0 ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function calendarDays(universe: Universe) {
  const now = new Date()
  return wordsByDay(universe, (WEEKS - 1) * 7 + now.getDay() + 1, now)
}

/** O calendário de escrita: as últimas semanas, um quadrinho por dia, mais forte quanto mais palavras. */
export function WritingCalendar({ universe }: { universe: Universe }) {
  const goal = universe.settings.dailyWordGoal || 500
  // Colunas de domingo a sábado; a última coluna termina hoje.
  const days = useMemo(() => calendarDays(universe), [universe])
  const streak = currentStreak(days)
  const best = bestStreak(days)
  const active = days.filter((d) => d.words > 0).length
  if (!active) return <p className="muted small">O calendário de escrita aparece aqui conforme você escreve.</p>
  const level = (w: number) => (w === 0 ? 0 : w < goal * 0.25 ? 1 : w < goal ? 2 : w < goal * 2 ? 3 : 4)

  return (
    <div className="writing-calendar">
      <div className="writing-calendar-grid" role="img" aria-label={`Calendário de escrita: ${active} dias com escrita nas últimas ${WEEKS} semanas`}>
        {days.map((d) => (
          <span
            key={d.day}
            className="writing-calendar-day"
            data-level={level(d.words)}
            title={`${dayFmt.format(new Date(`${d.day}T12:00`))}: ${d.words.toLocaleString('pt-BR')} ${d.words === 1 ? 'palavra' : 'palavras'}`}
          />
        ))}
      </div>
      <p className="muted small">
        {streak > 0 ? `${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'} escrevendo` : 'Escreva hoje para começar uma sequência'}
        {best > streak && ` · melhor: ${best}`} · {active} {active === 1 ? 'dia' : 'dias'} com escrita
      </p>
    </div>
  )
}

const deadlineFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** A meta do livro com prazo: quanto já foi, quanto falta e quantas palavras por dia. */
export function DeadlineLine({ universe }: { universe: Universe }) {
  const plan = deadlinePlan(universe)
  if (!plan) return null
  const when = deadlineFmt.format(new Date(`${plan.date}T12:00:00Z`))
  const pct = Math.min(100, (plan.total / plan.target) * 100)
  return (
    <div className="deadline-line">
      <p className="small">
        <strong>Meta do livro:</strong> {plan.total.toLocaleString('pt-BR')} de {plan.target.toLocaleString('pt-BR')} palavras até {when}.
      </p>
      <span className="resource-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <p className="muted small">
        {plan.done
          ? 'Meta batida! Quer aumentar? É em Ajustes → Universo.'
          : plan.late
            ? `O prazo passou e faltam ${plan.left.toLocaleString('pt-BR')} palavras. Que tal uma data nova, em Ajustes → Universo?`
            : `${plan.perDay.toLocaleString('pt-BR')} palavras por dia para chegar lá (${plan.daysLeft === 1 ? 'último dia' : `${plan.daysLeft} dias`}).`}
      </p>
    </div>
  )
}
