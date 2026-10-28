import { ArrowRight, BookMarked, BookOpen, Dices, Feather, GraduationCap, ImagePlus, Inbox, Library, Lightbulb, Loader2, Plus, Search, Sprout, Users, X } from 'lucide-react'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import { useMemo, useState } from 'react'
import { continuityQuestions, isOpen } from '../logic/continuity'
import { wordsByDay, wordsToday } from '../logic/stats'
import { kindLabel, SESSION_STATUS_LABEL } from '../model/labels'
import { addScene, byId, manuscriptOrder, updateScene } from '../model/universe'
import { countWords, wordCount } from '../persistence/repository'
import { recall } from '../state/prefs'
import { currentStreak, DeadlineLine, WritingCalendar } from './WritingCalendar'
import { ProgressSection } from './PlayCards'
import { TreinoCard } from '../treino/TreinoCard'
import { docFromParagraphs } from '../model/doc'
import { guessGuide, tipOfTheDay } from '../oficina/guides'
import { ALL_ITEMS } from '../shell/nav'
import { useWorkspace, type View } from '../state/workspace'

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const when = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Início do universo: onde parei, o dia de escrita, o que pede atenção e atalhos. */
export default function HomeView() {
  const { universe, prefs, go, peek, update, openCapture, openSearch, closeUniverse, source, openShare, openReader, readOnly, toast, hiddenViews } = useWorkspace()
  const cover = universe.settings.cover ?? null
  const setCover = (ref: string | null) => update((u) => ({ ...u, settings: { ...u.settings, cover: ref } }))
  const coverPicker = useImagePicker('capa', (ref) => setCover(ref), (m) => toast(m, { tone: 'erro' }))
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
  const showRpg = !hiddenViews.includes('rpg') && universe.groups.length > 0
  const nextSession = universe.sessions
    .filter((s) => s.status !== 'encerrada')
    .sort((a, b) => (a.status === 'em-andamento' ? -1 : b.status === 'em-andamento' ? 1 : a.playedOn.localeCompare(b.playedOn)))[0]
  const recent = [
    ...universe.scenes.map((s) => ({ kind: 'cena' as const, id: s.id, title: s.title || 'Sem título', detail: `${wordCount(s.text)} palavras`, at: s.updatedAt })),
    ...universe.entities.map((e) => ({ kind: 'ficha' as const, id: e.id, title: e.name || 'Sem nome', detail: kindLabel(e.kind), at: e.updatedAt })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)

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

  const streak = currentStreak(wordsByDay(universe, 120))
  const goalPct = goal > 0 ? Math.min(100, (today / goal) * 100) : 0
  const shown = (v: View) => !hiddenViews.includes(v)
  const doors = (
    [
      ['escrever', `${scenes.length} ${scenes.length === 1 ? 'cena' : 'cenas'}`],
      ['livro', `${total.toLocaleString('pt-BR')} palavras`],
      ['fichas', `${universe.entities.length} ${universe.entities.length === 1 ? 'ficha' : 'fichas'}`],
      ['atlas', universe.maps.length ? `${universe.maps.length} ${universe.maps.length === 1 ? 'mapa' : 'mapas'}` : 'Desenhe o mundo'],
      ['timeline', `${universe.events.length} ${universe.events.length === 1 ? 'evento' : 'eventos'}`],
      ['relacoes', `${universe.relations.length} ${universe.relations.length === 1 ? 'laço' : 'laços'}`],
      ['tramas', openSeeds ? `${openSeeds} em aberto` : 'Plante pistas'],
      showRpg ? ['rpg', `${universe.sessions.length} ${universe.sessions.length === 1 ? 'sessão' : 'sessões'}`] : ['inbox', inbox ? `${inbox} esperando` : 'Guarde ideias'],
    ] as [View, string][]
  )
    .filter(([v]) => shown(v))
    .map(([v, detail]) => ({ ...ALL_ITEMS.find((i) => i.view === v)!, detail }))

  return (
    <div className="view home">
      <header className={`home-hero${cover ? ' has-cover' : ''}`}>
        {cover ? (
          <Picture value={cover} className="home-hero-cover" />
        ) : (
          <span className="home-hero-mark" aria-hidden="true">
            {(universe.name || 'P').trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="home-top">
          <p className="eyebrow">
            {greeting()} · {todayLabel}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void closeUniverse()}>
            <Library size={15} /> Seus universos
          </button>
        </div>
        <h1>{universe.name || 'Sem nome'}</h1>
        {universe.description && <p className="home-desc">{universe.description}</p>}
        <div className="home-chips">
          <span className="home-chip" title={goal > 0 ? `Meta do dia: ${goal.toLocaleString('pt-BR')} palavras` : undefined}>
            {goal > 0 && <span className="home-ring" style={{ '--p': goalPct } as React.CSSProperties} aria-hidden="true" />}
            <span>
              <strong className="tabular">{today.toLocaleString('pt-BR')}</strong>
              {goal > 0 ? ` de ${goal.toLocaleString('pt-BR')}` : ` ${today === 1 ? 'palavra' : 'palavras'}`} hoje
            </span>
          </span>
          <span className="home-chip">{streak > 0 ? `🔥 ${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}` : '🔥 Comece uma sequência'}</span>
        </div>
        <div className="home-quick">
          <button type="button" className="home-quick-btn" aria-label="Anotar uma ideia" onClick={openCapture}>
            <Lightbulb size={15} aria-hidden="true" /> Ideia
          </button>
          <button type="button" className="home-quick-btn" aria-label="Buscar em tudo" onClick={openSearch}>
            <Search size={15} aria-hidden="true" /> Buscar
          </button>
          {source.kind === 'proprio' && (
            <button type="button" className="home-quick-btn" aria-label="Compartilhar" onClick={openShare}>
              <Users size={15} aria-hidden="true" /> Compartilhar
            </button>
          )}
          {!readOnly && (
            <>
              {coverPicker.field}
              <button type="button" className="home-quick-btn" aria-label={cover ? 'Trocar a capa do universo' : 'Pôr uma capa no universo'} onClick={coverPicker.open} disabled={coverPicker.busy}>
                {coverPicker.busy ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />} Capa
              </button>
              {cover && (
                <button type="button" className="home-quick-btn" aria-label="Tirar a capa do universo" title="Tirar a capa" onClick={() => setCover(null)}>
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="home-layout">
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
          ) : showRpg ? (
            <>
              {/* Campanha sem texto ainda: a mesa vem primeiro. */}
              <p className="eyebrow">
                <Dices size={13} aria-hidden="true" /> {universe.groups[0].name} · sua mesa
              </p>
              <h2>{nextSession ? nextSession.title || 'Próxima sessão' : 'Nenhuma sessão marcada'}</h2>
              {nextSession?.prep ? <p className="home-excerpt">{nextSession.prep}</p> : <p className="muted">Fichas dos personagens, sessões, dados e o Codex dos jogadores estão na mesa.</p>}
              <div className="inline-fields">
                <button type="button" className="btn btn-primary" onClick={() => go('rpg', nextSession?.id ?? null)}>
                  <Dices size={16} /> Abrir a mesa
                </button>
                <button type="button" className="btn btn-ghost" onClick={newScene}>
                  <Feather size={16} /> Começar a escrever
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

        <div className="home-challenge">
          <TreinoCard
            onKeepScene={
              readOnly
                ? undefined
                : (t) => {
                    // O texto do treino vira uma cena solta, com a proposta na sinopse.
                    const paragraphs = t.text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
                    update((u) => {
                      const [next, sc] = addScene(u, null, `Treino: ${t.prompt.slice(0, 48)}${t.prompt.length > 48 ? '…' : ''}`)
                      return updateScene(next, sc.id, { synopsis: t.prompt, doc: docFromParagraphs(paragraphs), text: paragraphs.join('\n\n') })
                    })
                    toast('O treino virou uma cena (em Escrever, fora dos capítulos).')
                  }
            }
          />
        </div>

        <nav className="home-doors" aria-label="O seu mundo">
          <h2 className="section-title">O seu mundo</h2>
          <ul>
            {doors.map((d) => (
              <li key={d.view}>
                <button type="button" className="home-door" onClick={() => go(d.view)}>
                  <span className="home-door-icon" aria-hidden="true">
                    <d.icon size={20} />
                  </span>
                  <span className="home-door-label">{d.label}</span>
                  <span className="home-door-detail muted small">{d.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="home-card home-day" aria-label="Seu ritmo">
          <p className="eyebrow">Seu ritmo</p>
          <DeadlineLine universe={universe} />
          <WritingCalendar universe={universe} />
          <ProgressSection />
        </section>

        <div className="home-side">
          <TipCard />

          {(attention.length > 0 || showRpg) && (
            <section className="home-card" aria-label="Pede atenção">
              <h2 className="section-title">Pede atenção</h2>
              {attention.length > 0 && (
                <ul className="home-list">
                  {attention.map((a) => (
                    <li key={a.text}>
                      <button type="button" className="home-row" onClick={a.go}>
                        <a.icon size={16} aria-hidden="true" /> {a.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showRpg && (
                <div className={attention.length ? 'home-session' : undefined}>
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
          )}

          {recent.length > 0 && (
            <section className="home-card" aria-label="Mexido por último">
              <h2 className="section-title">Mexido por último</h2>
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
            </section>
          )}
        </div>
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

function greeting(h = new Date().getHours()) {
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
}

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
