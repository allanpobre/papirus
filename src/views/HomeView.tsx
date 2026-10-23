import { BookMarked, Dices, Feather, Inbox, Lightbulb, Plus, Search, Sprout } from 'lucide-react'
import { useMemo, useState } from 'react'
import { continuityQuestions, isOpen } from '../logic/continuity'
import { wordsByDay, wordsToday } from '../logic/stats'
import { kindLabel, SESSION_STATUS_LABEL } from '../model/labels'
import { addScene, byId, manuscriptOrder } from '../model/universe'
import { countWords, wordCount } from '../persistence/repository'
import { recall } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow' })
const when = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Início do universo: onde parei, o dia de escrita, o que pede atenção e atalhos. */
export default function HomeView() {
  const { universe, prefs, go, peek, update, openCapture, openSearch } = useWorkspace()
  const scenes = useMemo(() => manuscriptOrder(universe), [universe])
  const [todayLabel] = useState(() => capitalize(longDate.format(new Date())))
  const lastId = recall(`cena:${universe.id}`)
  const last = (lastId && byId(universe, 'scenes', lastId)) || [...universe.scenes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const story = last?.storyId ? byId(universe, 'stories', last.storyId) : undefined
  const total = countWords(universe)
  const today = wordsToday(universe)
  const goal = universe.settings.dailyWordGoal
  const week = wordsByDay(universe, 7)
  const weekMax = Math.max(goal || 0, ...week.map((d) => d.words), 1)
  const questions = useMemo(() => continuityQuestions(universe, prefs.continuity).filter(isOpen), [universe, prefs.continuity])
  const inbox = universe.inbox.filter((i) => i.status === 'aberto').length
  const drafts = universe.entities.filter((e) => e.editorial === 'rascunho').length
  const openSeeds = universe.seeds.filter((s) => s.status !== 'resolvida' && s.status !== 'abandonada').length
  const showRpg = !prefs.hiddenViews.includes('rpg') && universe.groups.length > 0
  const nextSession = universe.sessions
    .filter((s) => s.status !== 'encerrada')
    .sort((a, b) => (a.status === 'em-andamento' ? -1 : b.status === 'em-andamento' ? 1 : a.playedOn.localeCompare(b.playedOn)))[0]
  const recent = [
    ...universe.scenes.map((s) => ({ kind: 'cena' as const, id: s.id, title: s.title || 'Sem título', detail: `${wordCount(s.text)} palavras`, at: s.updatedAt })),
    ...universe.entities.map((e) => ({ kind: 'ficha' as const, id: e.id, title: e.name || 'Sem nome', detail: kindLabel(e.kind), at: e.updatedAt })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  const newScene = () => {
    let id = ''
    update((u) => {
      const [next, s] = addScene(u, last?.storyId ?? null)
      id = s.id
      return next
    })
    go('escrever', id)
  }

  const attention = [
    questions.length > 0 && { icon: Lightbulb, text: `${questions.length} ${questions.length === 1 ? 'pergunta' : 'perguntas'} de continuidade`, go: () => go('escrever') },
    inbox > 0 && { icon: Inbox, text: `${inbox} ${inbox === 1 ? 'ideia' : 'ideias'} na Inbox`, go: () => go('inbox') },
    drafts > 0 && { icon: BookMarked, text: `${drafts} ${drafts === 1 ? 'ficha' : 'fichas'} em rascunho`, go: () => go('fichas') },
    openSeeds > 0 && { icon: Sprout, text: `${openSeeds} ${openSeeds === 1 ? 'trama aberta' : 'tramas abertas'}`, go: () => go('tramas') },
  ].filter(Boolean) as { icon: typeof Inbox; text: string; go: () => void }[]

  return (
    <div className="view home">
      <header className="home-head">
        <p className="eyebrow">{todayLabel}</p>
        <h1>{universe.name || 'Sem nome'}</h1>
        {universe.description && <p className="home-desc">{universe.description}</p>}
      </header>

      <div className="home-grid">
        <section className="home-card home-continue" aria-label="Continuar">
          {last ? (
            <>
              <p className="eyebrow">{story ? story.title : 'Cena solta'} · onde você parou</p>
              <h2>{last.title || 'Sem título'}</h2>
              {last.text.trim() ? (
                <p className="home-excerpt">{lastLines(last.text)}</p>
              ) : (
                <p className="muted">Página em branco.</p>
              )}
              <div className="inline-fields">
                <button type="button" className="btn btn-primary" onClick={() => go('escrever', last.id)}>
                  <Feather size={16} /> Continuar escrevendo
                </button>
                <button type="button" className="btn btn-ghost" onClick={newScene}>
                  <Plus size={16} /> Nova cena
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Primeira página</p>
              <h2>Nada escrito ainda.</h2>
              <p className="muted">Comece por uma cena. Fichas, linha do tempo e o resto podem vir depois, ou nunca.</p>
              <button type="button" className="btn btn-primary" onClick={newScene}>
                <Feather size={16} /> Começar a escrever
              </button>
            </>
          )}
        </section>

        <section className="home-card home-day" aria-label="Escrita da semana">
          <p className="eyebrow">Hoje</p>
          <p className="home-today">
            <strong className="tabular">{today.toLocaleString('pt-BR')}</strong> {today === 1 ? 'palavra' : 'palavras'}
            {goal > 0 && <span className="muted"> de {goal.toLocaleString('pt-BR')}</span>}
          </p>
          {goal > 0 && (
            <span className="resource-bar home-goal" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
            </span>
          )}
          {week.every((d) => d.words === 0) ? (
            <p className="muted small">O gráfico da semana aparece aqui conforme você escreve.</p>
          ) : (
          <div className="home-week" role="img" aria-label={`Últimos 7 dias: ${week.map((d) => d.words).join(', ')} palavras`}>
            {week.map((d) => (
              <span key={d.day} className="home-week-day">
                <span className="home-week-bar" style={{ height: `${Math.max(3, (d.words / weekMax) * 100)}%` }} data-empty={d.words === 0 || undefined} />
                <span className="home-week-label">{shortDay.format(new Date(d.day + 'T12:00'))}</span>
              </span>
            ))}
          </div>
          )}
          <p className="muted small tabular">
            {total.toLocaleString('pt-BR')} palavras · {scenes.length} {scenes.length === 1 ? 'cena' : 'cenas'} · {universe.entities.length} fichas · {universe.facts.length} fatos
          </p>
        </section>

        <section className="home-card" aria-label="Pede atenção">
          <h2 className="section-title">Pede atenção</h2>
          {attention.length ? (
            <ul className="home-list">
              {attention.map((a) => (
                <li key={a.text}>
                  <button type="button" className="home-row" onClick={a.go}>
                    <a.icon size={16} aria-hidden="true" /> {a.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nada pendente. Bom momento para escrever.</p>
          )}
          {showRpg && (
            <div className="home-session">
              <h3 className="section-label">
                <Dices size={14} aria-hidden="true" /> Mesa
              </h3>
              {nextSession ? (
                <button type="button" className="home-row" onClick={() => go('rpg', nextSession.id)}>
                  {nextSession.title} <span className="muted small">· {SESSION_STATUS_LABEL[nextSession.status]}</span>
                </button>
              ) : (
                <button type="button" className="home-row" onClick={() => go('rpg')}>
                  Planejar a próxima sessão
                </button>
              )}
            </div>
          )}
        </section>

        <section className="home-card" aria-label="Mexido por último">
          <h2 className="section-title">Mexido por último</h2>
          {recent.length ? (
            <ul className="home-list">
              {recent.map((r) => (
                <li key={r.kind + r.id}>
                  <button type="button" className="home-row" onClick={() => (r.kind === 'cena' ? go('escrever', r.id) : peek(r.id))}>
                    <span className="home-row-title">{r.title}</span>
                    <span className="muted small">
                      {r.kind === 'cena' ? 'Cena' : r.detail} · {when.format(new Date(r.at))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Ainda nada.</p>
          )}
        </section>
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-ghost" onClick={openCapture}>
          <Lightbulb size={16} /> Anotar uma ideia
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go('fichas')}>
          <BookMarked size={16} /> Fichas
        </button>
        <button type="button" className="btn btn-ghost" onClick={openSearch}>
          <Search size={16} /> Buscar em tudo
        </button>
      </div>
    </div>
  )
}

/** As últimas frases da cena, começando numa frase inteira. */
function lastLines(text: string, size = 240): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= size) return clean
  const tail = clean.slice(-size)
  const start = tail.search(/[.!?…]\s+\S/)
  return start >= 0 && start < size - 40 ? tail.slice(start + 1).trim() : `…${tail.trim()}`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
