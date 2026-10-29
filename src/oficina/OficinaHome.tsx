import { ArrowLeft, ArrowRight, Award, BookOpen, Check, Flame, NotebookPen, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { tabListKeys } from '../ui/keys'
import { recall, remember } from '../state/prefs'
import { treinoStreak, useTreinos, type Treino } from '../treino/treino'
import { GUIDES, sectionOf, type Guide, type GuideId } from './guides'
import { IdeaGenerator } from './IdeaGenerator'
import { LOOK, SECTIONS } from './look'
import { chooseTrail, exerciseKey, skipQuestion, useOficinaProgress, type OficinaProgress } from './progress'
import { StepPage } from './StepPage'
import { doneCount, isStepDone, nextStep, startedTrails, STEP_KIND_LABEL, stepTime, todayStep, trailComplete, trailOf, TRAILS, type Trail, type TrailStep } from './trails'

type Tab = 'hoje' | 'trilhas' | 'caderno' | 'biblioteca'
const TABS: [Tab, string][] = [
  ['hoje', 'Hoje'],
  ['trilhas', 'Trilhas'],
  ['caderno', 'Caderno'],
  ['biblioteca', 'Biblioteca'],
]

/** O que a Oficina pode fazer com o universo aberto (fora de um universo, nada disso aparece). */
export interface OficinaLinks {
  /** Transforma a ideia sorteada numa cena. */
  onPractice?: (title: string, prompt: string) => void
  /** Guarda uma ideia nas Ideias do universo. */
  onKeep?: (text: string) => void
  /** O texto de um passo vira uma cena. */
  onKeepScene?: (t: Treino) => void
  /** Numa campanha: manda o texto para o Roteiro da próxima sessão. */
  onRoteiro?: (kind: 'inicio' | 'cena', text: string) => string | null
}


/**
 * A capa da Oficina: o passo de hoje, as trilhas, o caderno com o que foi treinado e a
 * biblioteca com os guias. Fica no início do app (setor Oficina) e por cima de um universo.
 */
export function OficinaCover({ genre, onChoose, ...links }: { genre?: GuideId; onChoose: (id: GuideId) => void } & OficinaLinks) {
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = recall('oficina-aba') as Tab | null
    return saved && TABS.some(([t]) => t === saved) ? saved : 'hoje'
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    setTrail(null)
    remember('oficina-aba', t)
  }
  const [trail, setTrail] = useState<GuideId | null>(null)
  const [running, setRunning] = useState<{ trail: Trail; step: TrailStep } | null>(null)
  const progress = useOficinaProgress()
  const list = useTreinos()
  const streak = treinoStreak(list)
  const forTable = genre === 'mestrar' || genre === 'aventuras'
  const start = (t: Trail, step: TrailStep) => setRunning({ trail: t, step })

  return (
    <div className="oficina-cover">
      <section className="oficina-hero oficina-hero-small">
        <p className="oficina-kicker">Oficina</p>
        <h1 className="oficina-hero-title">{forTable ? 'Mestrar melhor, um pouco por dia.' : 'Escrever melhor, um pouco por dia.'}</h1>
        {streak > 0 && (
          <p className="oficina-progress" role="status">
            <Flame size={14} aria-hidden="true" /> {streak} {streak === 1 ? 'dia' : 'dias'} seguidos de treino
          </p>
        )}
      </section>

      <div className="tabs oficina-tabs" role="tablist" aria-label="Oficina" onKeyDown={tabListKeys}>
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {trail ? (
        <TrailView trail={trailOf(trail)} progress={progress} onBack={() => setTrail(null)} onStart={start} onGuide={() => onChoose(trail)} />
      ) : tab === 'hoje' ? (
        <TodayTab genre={genre} progress={progress} list={list} onStart={start} onTrail={setTrail} onTab={setTab} links={links} />
      ) : tab === 'trilhas' ? (
        <TrailsTab genre={genre} progress={progress} onTrail={setTrail} />
      ) : tab === 'caderno' ? (
        <Caderno progress={progress} list={list} onStart={start} />
      ) : (
        <Library genre={genre} progress={progress} onChoose={onChoose} />
      )}

      {running && (
        <StepPage
          key={`${running.trail.id}:${running.step.id}`}
          trail={running.trail}
          step={running.step}
          onClose={() => setRunning(null)}
          onNext={(step) => setRunning({ trail: running.trail, step })}
          onKeepScene={links.onKeepScene}
          onRoteiro={links.onRoteiro}
        />
      )}
    </div>
  )
}

function TodayTab({
  genre,
  progress,
  list,
  onStart,
  onTrail,
  onTab,
  links,
}: {
  genre?: GuideId
  progress: OficinaProgress
  list: Treino[]
  onStart: (t: Trail, s: TrailStep) => void
  onTrail: (id: GuideId) => void
  onTab: (t: Tab) => void
  links: OficinaLinks
}) {
  const today = todayStep(progress)
  const started = startedTrails(progress)
  const recent = list.filter((t) => progress.notes[t.id]).slice(0, 3)
  return (
    <div className="oficina-today">
      {!progress.asked ? (
        <FirstQuestion genre={genre} onTrail={onTrail} />
      ) : today ? (
        <TodayCard trail={today.trail} step={today.step} progress={progress} onStart={() => onStart(today.trail, today.step)} onTrail={() => onTrail(today.trail.id)} />
      ) : (
        <section className="oficina-today-card">
          <p className="oficina-today-kicker">
            <Award size={14} aria-hidden="true" /> Prateleira completa
          </p>
          <h2 className="oficina-today-title">Você fez todas as trilhas daqui.</h2>
          <button type="button" className="btn btn-primary" onClick={() => onTab('trilhas')}>
            Escolher outra trilha <ArrowRight size={16} />
          </button>
        </section>
      )}

      {started.length > 0 && (
        <section aria-labelledby="oficina-suas">
          <h2 className="oficina-h" id="oficina-suas">
            Suas trilhas
          </h2>
          <ul className="oficina-trail-rows">
            {started.map((t) => (
              <li key={t.id}>
                <TrailRow trail={t} progress={progress} onClick={() => onTrail(t.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="oficina-ultimos">
          <div className="oficina-h-row">
            <h2 className="oficina-h" id="oficina-ultimos">
              No caderno
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTab('caderno')}>
              Ver tudo <ArrowRight size={14} />
            </button>
          </div>
          <ul className="oficina-cad">
            {recent.map((t) => (
              <CadernoItem key={t.id} treino={t} progress={progress} />
            ))}
          </ul>
        </section>
      )}

      <IdeaGenerator initial={genre === 'mestrar' || genre === 'aventuras' ? 'mesa' : 'escrita'} onPractice={links.onPractice} onKeep={links.onKeep} />
    </div>
  )
}

/** Na primeira vez: o que a pessoa quer treinar escolhe a trilha do passo de hoje. */
function FirstQuestion({ genre, onTrail }: { genre?: GuideId; onTrail: (id: GuideId) => void }) {
  const [more, setMore] = useState<'genero' | 'tecnica' | null>(null)
  const mine = genre && genre !== 'fundamentos' ? GUIDES.find((g) => g.id === genre) : undefined
  const pick = (id: GuideId) => {
    chooseTrail(id)
    onTrail(id)
  }
  const options: [string, string, () => void][] = [
    ['Escrever melhor', 'Desejo e obstáculo, mostrar e contar, ponto de vista.', () => pick('fundamentos')],
    ['Um gênero', 'Fantasia, mistério, romance, terror…', () => setMore(more === 'genero' ? null : 'genero')],
    ['Uma técnica', 'Personagem, diálogo, ritmo, estrutura, revisão.', () => setMore(more === 'tecnica' ? null : 'tecnica')],
    ['Mestrar RPG', 'Preparar a sessão, começar na ação, vilões e pistas.', () => pick('mestrar')],
  ]
  return (
    <section className="oficina-first" aria-labelledby="oficina-pergunta">
      <h2 className="oficina-today-title" id="oficina-pergunta">
        O que você quer treinar?
      </h2>
      <p className="muted">Cada resposta abre uma trilha curta: ler uma técnica em um minuto e escrever dez. Dá para trocar quando quiser.</p>
      {mine && (
        <button type="button" className="btn btn-primary oficina-first-mine" onClick={() => pick(mine.id)}>
          {mine.label}, o gênero do seu universo <ArrowRight size={16} />
        </button>
      )}
      <div className="oficina-first-options">
        {options.map(([label, hint, go]) => (
          <button key={label} type="button" className="oficina-first-option" aria-expanded={label === 'Um gênero' ? more === 'genero' : label === 'Uma técnica' ? more === 'tecnica' : undefined} onClick={go}>
            <strong>{label}</strong>
            <span>{hint}</span>
          </button>
        ))}
      </div>
      {more && (
        <div className="oficina-first-chips" role="group" aria-label={more === 'genero' ? 'Gêneros' : 'Técnicas'}>
          {GUIDES.filter((g) => sectionOf(g) === more).map((g) => {
            const { icon: Icon, color } = LOOK[g.id]
            return (
              <button key={g.id} type="button" className="start-chip" style={{ '--g': color } as React.CSSProperties} onClick={() => pick(g.id)}>
                <Icon size={15} aria-hidden="true" /> {g.label}
              </button>
            )
          })}
        </div>
      )}
      <button type="button" className="link-btn small" onClick={skipQuestion}>
        Agora não (começar por Fundamentos)
      </button>
    </section>
  )
}

function TodayCard({ trail, step, progress, onStart, onTrail }: { trail: Trail; step: TrailStep; progress: OficinaProgress; onStart: () => void; onTrail: () => void }) {
  const { icon: Icon, color } = LOOK[trail.id]
  const n = trail.steps.findIndex((s) => s.id === step.id) + 1
  const other = trail.id !== progress.trail && progress.trail
  return (
    <section className="oficina-today-card" style={{ '--g': color } as React.CSSProperties} aria-labelledby="oficina-hoje">
      <p className="oficina-today-kicker">
        <Icon size={14} aria-hidden="true" /> Hoje · {trail.guide.label} · passo {n} de {trail.steps.length}
      </p>
      <h2 className="oficina-today-title" id="oficina-hoje">
        {step.title}
      </h2>
      <p className="oficina-today-text">{step.kind === 'licao' ? step.text : step.practice.prompt}</p>
      <p className="muted small">
        {STEP_KIND_LABEL[step.kind]} · {stepTime(trail, step)}
        {other && ` · a trilha de ${trailOf(other as GuideId).guide.label} acabou`}
      </p>
      <div className="oficina-today-actions">
        <button type="button" className="btn btn-primary" onClick={onStart}>
          <Play size={16} /> Começar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onTrail}>
          Ver a trilha
        </button>
      </div>
    </section>
  )
}

function TrailRow({ trail, progress, onClick }: { trail: Trail; progress: OficinaProgress; onClick: () => void }) {
  const { icon: Icon, color } = LOOK[trail.id]
  const done = doneCount(progress, trail)
  const complete = trailComplete(progress, trail)
  const next = nextStep(progress, trail)
  return (
    <button type="button" className={`oficina-trail-row${complete ? ' is-complete' : ''}`} style={{ '--g': color } as React.CSSProperties} onClick={onClick}>
      <span className="oficina-genre-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="oficina-trail-row-text">
        <strong>
          {trail.guide.label}
          {trail.id === progress.trail && <span className="oficina-genre-tag">a do passo de hoje</span>}
        </strong>
        <span className="oficina-trail-bar" aria-hidden="true">
          <span style={{ width: `${(done / trail.steps.length) * 100}%` }} />
        </span>
        <span className="muted small">
          {complete ? 'Completa' : `${done} de ${trail.steps.length}`}
          {next && done > 0 && ` · próximo: ${next.title}`}
        </span>
      </span>
      {complete ? <Award size={18} className="oficina-seal" aria-label="Selo da trilha" /> : <ArrowRight size={16} aria-hidden="true" />}
    </button>
  )
}

function TrailsTab({ genre, progress, onTrail }: { genre?: GuideId; progress: OficinaProgress; onTrail: (id: GuideId) => void }) {
  const forTable = genre === 'mestrar' || genre === 'aventuras'
  const sections = forTable ? [SECTIONS[2], SECTIONS[0], SECTIONS[1]] : SECTIONS
  return (
    <div className="oficina-trails">
      {sections.map((sec) => (
        <section key={sec.id} className="oficina-shelf-section" aria-labelledby={`trilhas-${sec.id}`}>
          <h2 className="oficina-h" id={`trilhas-${sec.id}`}>
            {sec.title}
          </h2>
          <ul className="oficina-trail-rows is-grid">
            {TRAILS.filter((t) => sectionOf(t.guide) === sec.id).map((t) => (
              <li key={t.id}>
                <TrailRow trail={t} progress={progress} onClick={() => onTrail(t.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** A trilha: os passos em fila, com o próximo à vista. */
function TrailView({ trail, progress, onBack, onStart, onGuide }: { trail: Trail; progress: OficinaProgress; onBack: () => void; onStart: (t: Trail, s: TrailStep) => void; onGuide: () => void }) {
  const { icon: Icon, color } = LOOK[trail.id]
  const next = nextStep(progress, trail)
  const mine = progress.trail === trail.id
  return (
    <article className="oficina-trail" style={{ '--g': color } as React.CSSProperties} aria-labelledby="trilha-titulo">
      <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <header className="oficina-trail-head">
        <span className="oficina-guide-icon" aria-hidden="true">
          <Icon size={26} />
        </span>
        <div>
          <p className="oficina-kicker">Trilha</p>
          <h2 id="trilha-titulo">{trail.guide.label}</h2>
          <p className="muted">{trail.guide.lede}</p>
        </div>
      </header>
      <div className="oficina-today-actions">
        {next && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              chooseTrail(trail.id)
              onStart(trail, next)
            }}
          >
            <Play size={16} /> {doneCount(progress, trail) ? `Continuar: ${next.title}` : 'Começar a trilha'}
          </button>
        )}
        {!mine && (
          <button type="button" className="btn" onClick={() => chooseTrail(trail.id)}>
            Usar no passo de hoje
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onGuide}>
          <BookOpen size={16} /> Ler o guia
        </button>
      </div>
      <ol className="oficina-path">
        {trail.steps.map((s, i) => {
          const done = isStepDone(progress, trail, s)
          const now = s === next
          return (
            <li key={s.id} className={`oficina-node is-${s.kind}${done ? ' is-done' : ''}${now ? ' is-now' : ''}`}>
              <span className="oficina-node-dot" aria-hidden="true">
                {done ? <Check size={14} /> : s.kind === 'revisao' ? <RotateCcw size={13} /> : s.kind === 'desafio' ? <Award size={14} /> : i + 1}
              </span>
              <button type="button" className="oficina-node-body" onClick={() => onStart(trail, s)}>
                <strong>{s.title}</strong>
                <span className="muted small">
                  {STEP_KIND_LABEL[s.kind]}
                  {done ? ' · feito' : now ? ' · o próximo' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function CadernoItem({ treino, progress, onRedo }: { treino: Treino; progress: OficinaProgress; onRedo?: () => void }) {
  const note = progress.notes[treino.id]
  const trail = note ? TRAILS.find((t) => t.id === note.trail) : undefined
  const step = trail?.steps.find((s) => s.id === note?.step)
  return (
    <li className="oficina-cad-item">
      <details>
        <summary>
          <span className="oficina-cad-date tabular">{dayFmt.format(new Date(`${treino.day}T12:00:00`))}</span>
          <span className="oficina-cad-title">
            <strong>{step ? step.title : treino.prompt}</strong>
            <span className="muted tiny">{trail ? `Trilha de ${trail.guide.label}` : treino.daily ? 'Treino do dia' : 'Treino'}</span>
          </span>
          <span className={`treino-badge${treino.done ? ' is-done' : ''}`}>{note?.score !== undefined ? `${Math.round(note.score * 100)}%` : `${treino.words} pal.`}</span>
        </summary>
        <p className="oficina-cad-text">{treino.text}</p>
        {note && step && note.answers.some(Boolean) && (
          <ul className="oficina-cad-answers small">
            {step.practice.ask.map(
              (q, i) =>
                note.answers[i] && (
                  <li key={q}>
                    {q} <strong>{note.answers[i]}</strong>
                  </li>
                ),
            )}
          </ul>
        )}
        {onRedo && (
          <button type="button" className="btn btn-sm" onClick={onRedo}>
            <RotateCcw size={14} /> Refazer este passo
          </button>
        )}
      </details>
    </li>
  )
}

/** O caderno: tudo o que foi treinado (passos das trilhas e treinos do dia), do mais novo ao mais velho. */
function Caderno({ progress, list, onStart }: { progress: OficinaProgress; list: Treino[]; onStart: (t: Trail, s: TrailStep) => void }) {
  const [limit, setLimit] = useState(20)
  if (!list.length)
    return (
      <section className="oficina-empty">
        <NotebookPen size={28} aria-hidden="true" />
        <p>O caderno guarda tudo o que você escreve na Oficina e nos treinos do dia, para reler e refazer depois.</p>
      </section>
    )
  return (
    <section aria-label="Caderno">
      <p className="muted small">
        {list.length} {list.length === 1 ? 'texto' : 'textos'}. Toque para reler. Com conta, o caderno vai junto para os outros aparelhos.
      </p>
      <ul className="oficina-cad">
        {list.slice(0, limit).map((t) => {
          const note = progress.notes[t.id]
          const trail = note ? TRAILS.find((x) => x.id === note.trail) : undefined
          const step = trail?.steps.find((s) => s.id === note?.step)
          return <CadernoItem key={t.id} treino={t} progress={progress} onRedo={trail && step ? () => onStart(trail, step) : undefined} />
        })}
      </ul>
      {list.length > limit && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit(limit + 20)}>
          Mostrar mais
        </button>
      )}
    </section>
  )
}

/** A biblioteca: os guias para ler, com o que já foi aberto. */
function Library({ genre, progress, onChoose }: { genre?: GuideId; progress: OficinaProgress; onChoose: (id: GuideId) => void }) {
  const mine = genre && genre !== 'fundamentos' ? genre : null
  const forTable = genre === 'mestrar' || genre === 'aventuras'
  const sections = forTable ? [SECTIONS[2], SECTIONS[0], SECTIONS[1]] : SECTIONS
  const doneIn = (g: Guide) => g.exercises.filter((e) => progress.done.includes(exerciseKey(g.id, e.title))).length
  let i = 0
  return (
    <div className="oficina-library">
      <p className="oficina-section-lede">Os guias completos: o que funciona, armadilhas, livros para estudar, curiosidades e mais exercícios.</p>
      {sections.map((sec) => (
        <section key={sec.id} className="oficina-shelf-section" aria-labelledby={`oficina-${sec.id}`}>
          <h2 className="oficina-h" id={`oficina-${sec.id}`}>
            {sec.title}
          </h2>
          <p className="oficina-section-lede">{sec.lede}</p>
          <ul className="oficina-genres">
            {GUIDES.filter((g) => sectionOf(g) === sec.id).map((g) => {
              const { icon: Icon, color } = LOOK[g.id]
              const done = doneIn(g)
              const read = progress.read.includes(g.id)
              return (
                <li key={g.id} style={{ '--g': color, '--i': i++ } as React.CSSProperties}>
                  <button type="button" className={`oficina-genre${g.id === mine ? ' is-mine' : ''}`} onClick={() => onChoose(g.id)}>
                    <span className="oficina-genre-icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <span className="oficina-genre-name">{g.label}</span>
                    <span className="oficina-genre-lede">{g.lede}</span>
                    {g.id === mine && <span className="oficina-genre-tag">{forTable ? 'a sua mesa' : 'o seu universo'}</span>}
                    {read && (
                      <span className="oficina-genre-done">
                        <Check size={12} aria-hidden="true" /> {done > 0 ? `${done}/${g.exercises.length} feitos` : 'lido'}
                      </span>
                    )}
                    <ArrowRight size={16} className="oficina-genre-go" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
