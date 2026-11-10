import { BookOpen, Dices, Feather, ImagePlus, Inbox, Library, Lightbulb, Loader2, Plus, Search, Timer, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import { continuityQuestions, isOpen } from '../logic/continuity'
import { streakLine, todayTarget, weekDots, worldCounts } from '../logic/homeToday'
import { wordsToday } from '../logic/stats'
import { universeKind } from '../model/kind'
import { SESSION_STATUS_LABEL } from '../model/labels'
import { addScene, byId, manuscriptOrder, sceneTitle } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { useWorkspace, type View } from '../state/workspace'
import { MoreMenu } from '../ui/MoreMenu'
import { PageHelp } from '../ui/PageTour'
import { GeneratedCover } from '../ui/GeneratedCover'
import { useMediaQuery } from '../ui/useMediaQuery'
import { FirstSteps } from './FirstSteps'
import { NextNote } from './NextNote'
import { ProgressSection } from './PlayCards'
import { startSprint } from './write/sprintClock'
import { saveMode } from './write/WritingModes'
import { DeadlineLine, WritingCalendar } from './WritingCalendar'

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const untilFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/**
 * Início do universo: uma porta, não um painel. No alto, o dia (palavras, a semana, atalhos);
 * no meio, o próximo passo grande (a última frase, o bilhete para amanhã, continuar); o resto
 * pequeno e só quando importa: até três coisas "para quando der", o treino, o mundo numa linha
 * e o ritmo dobrado.
 */
export default function HomeView() {
  const { universe, prefs, go, update, openCapture, openSearch, closeUniverse, source, openShare, openReader, readOnly, toast, hiddenViews } = useWorkspace()
  const cover = universe.settings.cover ?? null
  const setCover = (ref: string | null) => update((u) => ({ ...u, settings: { ...u.settings, cover: ref } }))
  const coverPicker = useImagePicker(
    'capa',
    (ref) => setCover(ref),
    (m) => toast(m, { tone: 'erro' }),
  )
  const scenes = useMemo(() => manuscriptOrder(universe), [universe])
  const [todayLabel] = useState(() => capitalize(longDate.format(new Date())))
  const shown = (v: View) => !hiddenViews.includes(v)
  // No celular, só o fim do trecho (a última frase é o que importa para continuar).
  const phone = useMediaQuery('(max-width: 520px)')

  // Onde parou: a cena lembrada; senão, a última editada de verdade (depois de criada); senão, a primeira.
  const lastId = recall(`cena:${universe.id}`)
  const edited = scenes.filter((x) => Date.parse(x.updatedAt) - Date.parse(x.createdAt) > 5000).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const last = (lastId && byId(universe, 'scenes', lastId)) || edited[0] || scenes[0]
  const story = last?.storyId ? byId(universe, 'stories', last.storyId) : undefined
  const others = edited.filter((s) => s.id !== last?.id && s.text.trim()).slice(0, 2)
  const hasText = scenes.some((s) => s.text.trim())

  const showRpg = shown('rpg') && universe.groups.length > 0
  // Numa campanha (ou num universo com mesa e nada escrito), o próximo passo é a mesa.
  const mesaFirst = showRpg && (universeKind(universe) === 'campanha' || !hasText)
  const nextSession = universe.sessions.filter((s) => s.status !== 'encerrada').sort((a, b) => (a.status === 'em-andamento' ? -1 : b.status === 'em-andamento' ? 1 : a.playedOn.localeCompare(b.playedOn)))[0]

  const today = wordsToday(universe)
  const { target, until } = todayTarget(universe)
  const week = weekDots(universe)
  const streak = streakLine(universe)
  const questions = useMemo(() => continuityQuestions(universe, prefs.continuity).filter(isOpen), [universe, prefs.continuity])
  const inbox = universe.inbox.filter((i) => i.status === 'aberto').length
  const world = worldCounts(universe, hiddenViews, showRpg)
  // O ritmo (calendário, nível, medalhas) só depois de escrever alguma coisa, ou com prazo marcado.
  const showRhythm = hasText || streak !== null || universe.settings.deadline !== null
  const [rhythmOpen, setRhythmOpen] = useState(() => recall('inicio-ritmo') === 'aberto')

  const newScene = () => {
    let id = ''
    update((u) => {
      const [next, s] = addScene(u, last?.storyId ?? null)
      id = s.id
      return next
    })
    go('escrever', id)
  }
  const sprint = () => {
    startSprint(universe, 15)
    toast('Sprint de 15 minutos: o relógio fica no rodapé da cena.')
    go('escrever', last?.id ?? null)
  }

  // Para quando der: até três coisas que pedem um olhar, sem cobrança.
  const later = [
    questions.length > 0 && {
      icon: Lightbulb,
      text: `${questions.length} ${questions.length === 1 ? 'pergunta' : 'perguntas'} da Revisão`,
      hint: 'Ver',
      go: () => {
        saveMode('revisao')
        go('escrever')
      },
    },
    inbox > 0 && shown('inbox') && { icon: Inbox, text: `${inbox} ${inbox === 1 ? 'ideia esperando' : 'ideias esperando'}`, hint: 'Abrir', go: () => go('inbox') },
    showRpg &&
      !mesaFirst && {
        icon: Dices,
        text: nextSession ? nextSession.title || 'Próxima sessão' : 'Planejar a próxima sessão',
        hint: nextSession ? SESSION_STATUS_LABEL[nextSession.status] : 'Mesa',
        go: () => go('rpg', nextSession?.id ?? null),
      },
  ].filter(Boolean) as { icon: typeof Inbox; text: string; hint: string; go: () => void }[]

  const pct = target > 0 ? Math.min(100, (today / target) * 100) : 0
  const wroteDays = week.filter((d) => d.words > 0).length

  return (
    <div className="view home">
      <header className="home-today" data-tour="hoje">
        <div className="home-id">
          {cover ? <Picture value={cover} className="home-thumb" /> : <GeneratedCover name={universe.name.replace(/^Exemplo\s*[—–-]\s*/, '')} tone={universeKind(universe) === 'campanha' ? 'var(--accent)' : undefined} className="home-thumb" />}
          <div className="home-id-text">
            <p className="eyebrow">
              {greeting()} · {todayLabel}
            </p>
            <h1>{universe.name || 'Sem nome'}</h1>
            {universe.description && <p className="home-desc">{universe.description}</p>}
          </div>
        </div>

        <div className="home-stats" data-tour="dia">
          {(today > 0 || target > 0 || hasText) && (
            <span className="home-stat" title={until ? `A meta de hoje sai do prazo do livro (${untilFmt.format(new Date(`${until}T12:00:00Z`))})` : undefined}>
              {target > 0 && <span className="home-ring" style={{ '--p': pct } as React.CSSProperties} aria-hidden="true" />}
              <span>
                <strong className="tabular">{today.toLocaleString('pt-BR')}</strong>
                {target > 0 ? ` de ${target.toLocaleString('pt-BR')}` : ` ${today === 1 ? 'palavra' : 'palavras'}`} hoje
                {until && <span className="home-stat-sub"> para chegar a {untilFmt.format(new Date(`${until}T12:00:00Z`))}</span>}
              </span>
            </span>
          )}
          {streak && (
            <span className="home-stat">
              <span className="home-week" role="img" aria-label={`Esta semana: escreveu em ${wroteDays} de 7 dias`}>
                {week.map((d) => (
                  <i key={d.day} className={`${d.words > 0 ? 'is-on' : ''}${d.today ? ' is-today' : ''}`} title={`${d.label}: ${d.words.toLocaleString('pt-BR')} ${d.words === 1 ? 'palavra' : 'palavras'}`} />
                ))}
              </span>
              <span className={streak.streak ? undefined : 'home-stat-sub'}>{streak.streak ? <strong>{streak.text}</strong> : streak.text}</span>
            </span>
          )}
        </div>

        <div className="home-quick">
          <button type="button" className="home-quick-btn has-label" aria-label="Anotar uma ideia" title="Anotar uma ideia" onClick={openCapture}>
            <Lightbulb size={16} aria-hidden="true" /> <span>Ideia</span>
          </button>
          <button type="button" className="home-quick-btn has-label" aria-label="Buscar em tudo" title="Buscar em tudo" onClick={openSearch}>
            <Search size={16} aria-hidden="true" /> <span>Buscar</span>
          </button>
          {hasText && (
            <button
              type="button"
              className="home-quick-btn has-label"
              aria-label={source.kind === 'proprio' || source.kind === 'editar' ? 'Ler como leitor' : 'Ler como livro'}
              title="O livro cena a cena, com o caderno do leitor (sem spoiler)"
              onClick={openReader}
            >
              <BookOpen size={16} aria-hidden="true" /> <span>Ler</span>
            </button>
          )}
          {/* No celular, os botões cabem numa linha: Compartilhar vai para o ⋯ (e está no "Mais" da barra de baixo). */}
          {source.kind === 'proprio' && !phone && (
            <button type="button" className="home-quick-btn has-label" aria-label="Compartilhar" title="Compartilhar" onClick={openShare}>
              <Users size={16} aria-hidden="true" /> <span>Compartilhar</span>
            </button>
          )}
          <PageHelp tour="inicio" />
          {!readOnly && coverPicker.field}
          <MoreMenu label="Mais do universo" buttonClass="home-quick-btn">
            {(close) => (
              <>
                {source.kind === 'proprio' && phone && (
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      openShare()
                    }}
                  >
                    <Users size={16} aria-hidden="true" /> Compartilhar
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    className="more-menu-item"
                    disabled={coverPicker.busy}
                    onClick={() => {
                      close()
                      coverPicker.open()
                    }}
                  >
                    {coverPicker.busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} {cover ? 'Trocar a capa do universo' : 'Pôr uma capa no universo'}
                  </button>
                )}
                {!readOnly && cover && (
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      setCover(null)
                    }}
                  >
                    <X size={16} aria-hidden="true" /> Tirar a capa do universo
                  </button>
                )}
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    close()
                    void closeUniverse()
                  }}
                >
                  <Library size={16} aria-hidden="true" /> Seus universos
                </button>
              </>
            )}
          </MoreMenu>
        </div>
      </header>

      <div className="home-layout">
        <section className="home-card home-next" aria-label="O próximo passo" data-tour="continuar">
          {mesaFirst ? (
            <>
              <p className="eyebrow">
                <Dices size={13} aria-hidden="true" /> Próxima sessão · {universe.groups[0].name}
              </p>
              <h2>{nextSession ? nextSession.title || 'Próxima sessão' : 'Nenhuma sessão marcada'}</h2>
              {nextSession?.prep ? <p className="home-excerpt">{nextSession.prep}</p> : <p className="muted">Fichas dos personagens, sessões, dados e o Codex dos jogadores estão na Mesa.</p>}
              <div className="home-next-actions">
                <button type="button" className="btn btn-primary" onClick={() => go('rpg', nextSession?.id ?? null)}>
                  <Dices size={16} /> Abrir a Mesa
                </button>
                {shown('escrever') && !readOnly && (
                  <button type="button" className="btn btn-ghost" onClick={newScene}>
                    <Feather size={16} /> Começar a escrever
                  </button>
                )}
              </div>
            </>
          ) : last && hasText ? (
            <>
              <p className="eyebrow">{story ? story.title : 'Sem capítulo'} · onde você parou</p>
              <h2>{sceneTitle(last)}</h2>
              {last.text.trim() ? <p className="home-excerpt">{lastLines(last.text, phone ? 170 : 360)}</p> : <p className="muted">Página em branco.</p>}
              <NextNote sceneId={last.id} place="inicio" />
              <div className="home-next-actions">
                <button type="button" className="btn btn-primary" onClick={() => go('escrever', last.id)}>
                  <Feather size={16} /> Continuar escrevendo
                </button>
                {!readOnly && (
                  <>
                    <button type="button" className="btn" title="Um sprint de 15 minutos nesta cena: escrever o quanto der, sem parar para corrigir" onClick={sprint}>
                      <Timer size={16} /> 15 minutos
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={newScene}>
                      <Plus size={16} /> Nova cena
                    </button>
                  </>
                )}
              </div>
              {others.length > 0 && (
                <p className="home-others small">
                  <span className="muted">Ou volte para:</span>{' '}
                  {others.map((s) => (
                    <button key={s.id} type="button" className="link-btn" onClick={() => go('escrever', s.id)}>
                      {sceneTitle(s)}
                    </button>
                  ))}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow">Primeira página</p>
              <h2>Comece por uma cena.</h2>
              <p className="muted">Fichas, mapas e o resto podem vir depois, ou nunca.</p>
              {!readOnly && (
                <div className="home-next-actions">
                  <button type="button" className="btn btn-primary" onClick={() => (last ? go('escrever', last.id) : newScene())}>
                    <Feather size={16} /> Começar a escrever
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <div className="home-side">
          {later.length > 0 && (
            <section className="home-card home-later" aria-label="Para quando der">
              <h2 className="section-title">Para quando der</h2>
              <ul className="home-list">
                {later.map((a) => (
                  <li key={a.text}>
                    <button type="button" className="home-row" onClick={a.go}>
                      <a.icon size={16} aria-hidden="true" /> <span className="home-row-title">{a.text}</span>
                      <span className="muted small">{a.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* O treino da Oficina mora na Oficina: o Início é do universo. */}
          <FirstSteps onScene={() => (last ? go('escrever', last.id) : newScene())} />
        </div>

        {world.length > 0 && (
          <nav className="home-world" aria-label="O seu mundo">
            <span className="home-world-title">O seu mundo:</span>
            <ul>
              {world.map((w) => (
                <li key={w.view}>
                  <button type="button" className="link-btn" onClick={() => go(w.view)}>
                    {w.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {showRhythm && (
          <details
            className="home-card home-day"
            open={rhythmOpen}
            onToggle={(e) => {
              const open = e.currentTarget.open
              setRhythmOpen(open)
              remember('inicio-ritmo', open ? 'aberto' : null)
            }}
          >
            <summary>
              <span className="home-day-title">Seu ritmo</span>
              <span className="muted small">calendário, prazo, nível e medalhas</span>
            </summary>
            {rhythmOpen && (
              <div className="home-day-body">
                <DeadlineLine universe={universe} />
                <WritingCalendar universe={universe} />
                <ProgressSection />
              </div>
            )}
          </details>
        )}
      </div>
    </div>
  )
}

/** As últimas frases da cena, começando numa frase inteira. */
function lastLines(text: string, size = 360): string {
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
