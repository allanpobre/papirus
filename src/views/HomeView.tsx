import { ArrowRight, BookMarked, BookOpen, Compass, Dices, Feather, GraduationCap, Inbox, Library, Lightbulb, Plus, Search, Sprout, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { continuityQuestions, isOpen } from '../logic/continuity'
import { wordsToday } from '../logic/stats'
import { kindLabel, SESSION_STATUS_LABEL } from '../model/labels'
import { addScene, byId, manuscriptOrder } from '../model/universe'
import { countWords, wordCount } from '../persistence/repository'
import { recall } from '../state/prefs'
import { DeadlineLine, WritingCalendar } from './WritingCalendar'
import { guessGuide, tipOfTheDay } from '../oficina/guides'
import { useWorkspace } from '../state/workspace'

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const when = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Início do universo: onde parei, o dia de escrita, o que pede atenção e atalhos. */
export default function HomeView() {
  const { universe, prefs, go, peek, update, openCapture, openSearch, closeUniverse, startTour, source, openShare, openReader } = useWorkspace()
  const scenes = useMemo(() => manuscriptOrder(universe), [universe])
  const [todayLabel] = useState(() => capitalize(longDate.format(new Date())))
  const lastId = recall(`cena:${universe.id}`)
  // Sem cena lembrada: a última editada de verdade (depois de criada); se nenhuma foi, a primeira do manuscrito.
  const edited = scenes.filter((x) => Date.parse(x.updatedAt) - Date.parse(x.createdAt) > 5000)
  const last =
    (lastId && byId(universe, 'scenes', lastId)) || (edited.length ? [...edited].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] : scenes[0])
  const story = last?.storyId ? byId(universe, 'stories', last.storyId) : undefined
  const total = countWords(universe)
  const today = wordsToday(universe)
  const goal = universe.settings.dailyWordGoal
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
    inbox > 0 && { icon: Inbox, text: `${inbox} ${inbox === 1 ? 'ideia' : 'ideias'} esperando em Ideias`, go: () => go('inbox') },
    drafts > 0 && { icon: BookMarked, text: `${drafts} ${drafts === 1 ? 'ficha' : 'fichas'} em rascunho`, go: () => go('fichas') },
    openSeeds > 0 && { icon: Sprout, text: `${openSeeds} ${openSeeds === 1 ? 'trama aberta' : 'tramas abertas'}`, go: () => go('tramas') },
  ].filter(Boolean) as { icon: typeof Inbox; text: string; go: () => void }[]

  return (
    <div className="view home">
      <header className="home-head">
        <div className="home-top">
          <p className="eyebrow">{todayLabel}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void closeUniverse()}>
            <Library size={15} /> Seus universos
          </button>
        </div>
        <h1>{universe.name || 'Sem nome'}</h1>
        {universe.description && <p className="home-desc">{universe.description}</p>}
      </header>

      <div className="home-grid">
        <section className="home-card home-continue" aria-label="Continuar" data-tour="continuar">
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
                <button type="button" className="btn btn-ghost" title="O livro cena a cena, com o caderno do leitor (sem spoiler)" onClick={openReader}>
                  <BookOpen size={16} /> {source.kind === 'proprio' || source.kind === 'editar' ? 'Ler como leitor' : 'Ler como livro'}
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
          <DeadlineLine universe={universe} />
          <WritingCalendar universe={universe} />
          <p className="muted small tabular">
            {total.toLocaleString('pt-BR')} palavras · {scenes.length} {scenes.length === 1 ? 'cena' : 'cenas'} · {universe.entities.length} fichas · {universe.facts.length} fatos
          </p>
        </section>

        <TipCard />

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
        {source.kind === 'proprio' && (
          <button type="button" className="btn btn-ghost" onClick={openShare}>
            <Users size={16} /> Compartilhar
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={startTour}>
          <Compass size={16} /> Fazer o tour
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

/** Dica do dia, tirada da Oficina (e o caminho até ela). */
function TipCard() {
  const { universe, go } = useWorkspace()
  const [tip] = useState(() => tipOfTheDay(guessGuide(universe.settings.fieldTemplates)))
  return (
    <section className="home-card home-tip" aria-label="Dica do dia">
      <p className="eyebrow">
        <GraduationCap size={13} aria-hidden="true" /> Dica do dia · {tip.guide.label}
      </p>
      <p className="home-tip-title">{tip.title}</p>
      <p className="small">{tip.text}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('oficina')}>
        Ver mais na Oficina <ArrowRight size={14} />
      </button>
    </section>
  )
}
