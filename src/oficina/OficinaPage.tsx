import { AlertTriangle, ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, GraduationCap, Lightbulb, PenLine, Play, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { useBackLayer } from '../ui/useBackLayer'
import { GUIDES, sectionOf, type Guide, type GuideId, type GuideSection } from './guides'
import { useOficinaSector } from './useOficinaSector'
import { LOOK } from './look'
import { OficinaCover, type OficinaLinks } from './OficinaHome'
import { chooseTrail, exerciseKey, markRead, toggleDone, useOficinaProgress } from './progress'
import { StepPage } from './StepPage'
import { doneCount, nextStep, trailOf, type Trail, type TrailStep } from './trails'
import { PageHelp } from '../ui/PageTour'

/** Os títulos de cada guia mudam com a prateleira (quem lê, quem escreve, quem joga). */
const HEADINGS: Record<GuideSection, { expect: string; exercises: string }> = {
  genero: { expect: 'O que o leitor espera', exercises: 'Mais exercícios' },
  tecnica: { expect: 'Por que importa', exercises: 'Mais exercícios' },
  mestre: { expect: 'O que a mesa espera', exercises: 'Para a próxima sessão' },
}

/**
 * A Oficina numa página própria, por cima de tudo: a capa (hoje, trilhas, caderno e
 * biblioteca) e, ao escolher um guia, o guia. O "voltar" do aparelho volta para a capa e depois fecha.
 */
export function OficinaPage({
  genre,
  start,
  onClose,
  ...links
}: {
  genre?: GuideId
  /** Abre direto neste guia (a capa já está atrás, no início do app): voltar fecha. */
  start?: GuideId
  onClose: () => void
} & OficinaLinks) {
  const [open, setOpen] = useState<GuideId | null>(start ?? null)
  const scroller = useRef<HTMLDivElement>(null)

  // A Oficina e o guia aberto são passos do "voltar" do aparelho: volta para a capa e depois fecha.
  useBackLayer(onClose)
  useOficinaSector()
  useBackLayer(() => setOpen(null), open !== null && !start)

  // Corpo com chaves: algumas extensões fazem scrollTo devolver um número, e o React
  // tentaria chamar esse número como limpeza do efeito ("1 is not a function").
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [open])

  const back = () => (start ? onClose() : setOpen(null))
  // Esc fecha (ou volta para a capa, se estiver num guia). Com um passo aberto, quem fecha é o passo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.step-page')) return
      if (open && !start) setOpen(null)
      else onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose, start])

  // A ideia sorteada ou o exercício viram uma cena: a Oficina sai antes, e a cena entra como o passo seguinte do "voltar".
  const practice =
    links.onPractice &&
    ((title: string, prompt: string) => {
      onClose()
      setTimeout(() => links.onPractice!(title, prompt), 0)
    })

  const guide = open ? GUIDES.find((g) => g.id === open) : null
  return createPortal(
    <div className="oficina-page" role="dialog" aria-modal="true" aria-label="Oficina">
      <div className="oficina-scroll" ref={scroller}>
        <header className="oficina-top">
          {guide ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={back}>
              <ArrowLeft size={16} /> {start ? 'Voltar' : 'Oficina'}
            </button>
          ) : (
            <span className="oficina-brand">
              <GraduationCap size={18} aria-hidden="true" /> Oficina
            </span>
          )}
          <PageHelp key={guide ? 'guia' : 'capa'} tour={guide ? 'oficina-guia' : 'oficina'} className="oficina-help" />
          <button type="button" className="btn-icon" aria-label="Fechar a Oficina" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <ErrorBoundary key={open ?? 'capa'} label="A Oficina não conseguiu abrir esta página." onReset={back}>
          {guide ? <GuidePage key={guide.id} guide={guide} onPractice={practice} onKeepScene={links.onKeepScene} onRoteiro={links.onRoteiro} /> : <OficinaCover genre={genre} onChoose={setOpen} {...links} onPractice={practice} />}
        </ErrorBoundary>
      </div>
    </div>,
    document.body,
  )
}

/** Faz cada bloco aparecer quando chega na tela (sem animação para quem prefere menos movimento). */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

/**
 * O guia: no alto, a trilha para praticar; o resto em seções que abrem e fecham, para ler
 * sem rolar telas e telas.
 */
function GuidePage({
  guide,
  onPractice,
  onKeepScene,
  onRoteiro,
}: {
  guide: Guide
  onPractice?: (title: string, prompt: string) => void
} & Pick<OficinaLinks, 'onKeepScene' | 'onRoteiro'>) {
  const { icon: Icon, color } = LOOK[guide.id]
  const ref = useReveal()
  const section = sectionOf(guide)
  const headings = HEADINGS[section]
  const progress = useOficinaProgress()
  const trail = trailOf(guide.id)
  const next = nextStep(progress, trail)
  const done = doneCount(progress, trail)
  const [running, setRunning] = useState<{ trail: Trail; step: TrailStep } | null>(null)
  // Abrir o guia já conta como lido.
  useEffect(() => markRead(guide.id), [guide.id])
  // Exercícios de mestre são para a mesa, não viram cena.
  const practice = section === 'mestre' ? undefined : onPractice
  // Um exercício do guia, feito aqui mesmo (o primeiro é o desafio da trilha).
  const train = (i: number) => {
    const e = guide.exercises[i]
    const desafio = i === 0 ? trail.steps.find((s) => s.kind === 'desafio') : undefined
    setRunning({
      trail,
      step: desafio ?? {
        id: `ex${i + 1}`,
        kind: 'licao',
        title: e.title,
        text: e.prompt,
        practice: { prompt: e.prompt, ask: ['O que você tentou neste exercício?', 'O que faria diferente amanhã?'] },
      },
    })
  }
  return (
    <article className="oficina-guide-page" ref={ref} style={{ '--g': color } as React.CSSProperties}>
      <header className="oficina-guide-hero">
        <span className="oficina-guide-icon" aria-hidden="true">
          <Icon size={30} />
        </span>
        <h1>{guide.label}</h1>
        <p>{guide.lede}</p>
        {next && (
          <button
            type="button"
            className="btn btn-primary oficina-guide-practice"
            onClick={() => {
              chooseTrail(guide.id)
              setRunning({ trail, step: next })
            }}
          >
            <Play size={16} /> {done ? `Continuar a trilha: ${next.title}` : `Praticar a trilha · ${trail.steps.length} passos`}
          </button>
        )}
      </header>

      <p className="oficina-expect-big" data-reveal>
        <span>{headings.expect}</span>
        {guide.expect}
      </p>

      <details className="oficina-fold" open>
        <summary className="oficina-h">
          O que funciona <span className="oficina-fold-n">{guide.works.length}</span>
        </summary>
        <ol className="oficina-works">
          {guide.works.map((w, i) => (
            <li key={w.title} style={{ '--i': i } as React.CSSProperties}>
              <span className="oficina-num" aria-hidden="true">
                {i + 1}
              </span>
              <strong>{w.title}</strong>
              <p>{w.text}</p>
            </li>
          ))}
        </ol>
      </details>

      <details className="oficina-fold">
        <summary className="oficina-h">
          <AlertTriangle size={18} aria-hidden="true" /> Armadilhas comuns <span className="oficina-fold-n">{guide.traps.length}</span>
        </summary>
        <ul className="oficina-traps-big">
          {guide.traps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>

      <details className="oficina-fold">
        <summary className="oficina-h">
          <BookOpen size={18} aria-hidden="true" /> Livros para estudar <span className="oficina-fold-n">{guide.books.length}</span>
        </summary>
        <ul className="oficina-shelf">
          {guide.books.map((b) => (
            <li key={b.title}>
              <span className="oficina-cover-mini" aria-hidden="true">
                <span>{b.title}</span>
              </span>
              <span className="oficina-book-info">
                <strong>{b.title}</strong>
                <span className="muted small">{b.author}</span>
                <span className="small">{b.what}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <Facts facts={guide.facts} />

      <details className="oficina-fold">
        <summary className="oficina-h">
          <Lightbulb size={18} aria-hidden="true" /> {headings.exercises} <span className="oficina-fold-n">{guide.exercises.length}</span>
        </summary>
        <ul className="oficina-ex">
          {guide.exercises.map((e, i) => {
            const key = exerciseKey(guide.id, e.title)
            const isDone = progress.done.includes(key)
            return (
              <li key={e.title} className={isDone ? 'is-done' : undefined}>
                <strong>{e.title}</strong>
                <p>{e.prompt}</p>
                <div className="oficina-ex-actions">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => train(i)}>
                    <Play size={14} /> Treinar aqui
                  </button>
                  {practice && (
                    <button type="button" className="btn btn-sm" onClick={() => practice(e.title, e.prompt)}>
                      <PenLine size={14} /> Virar uma cena
                    </button>
                  )}
                  <button type="button" className={`btn btn-sm btn-ghost oficina-done-btn${isDone ? ' is-on' : ''}`} aria-pressed={isDone} onClick={() => toggleDone(key)}>
                    <Check size={14} /> {isDone ? 'Feito' : 'Marcar como feito'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </details>

      {running && (
        <StepPage key={`${running.trail.id}:${running.step.id}`} trail={running.trail} step={running.step} onClose={() => setRunning(null)} onNext={(step) => setRunning({ trail, step })} onKeepScene={onKeepScene} onRoteiro={onRoteiro} />
      )}
    </article>
  )
}

/** As curiosidades, uma de cada vez. */
function Facts({ facts }: { facts: string[] }) {
  const [at, setAt] = useState(0)
  if (!facts.length) return null
  return (
    <section className="oficina-facts" aria-labelledby="of-curiosidades">
      <h2 id="of-curiosidades" className="oficina-h">
        <Sparkles size={18} aria-hidden="true" /> Você sabia?
      </h2>
      <p className="oficina-fact-card" aria-live="polite">
        {facts[at]}
      </p>
      <div className="oficina-fact-nav">
        <button type="button" className="btn-icon" aria-label="Curiosidade anterior" disabled={at === 0} onClick={() => setAt(at - 1)}>
          <ChevronLeft size={18} />
        </button>
        <span className="muted small tabular">
          {at + 1} de {facts.length}
        </span>
        <button type="button" className="btn-icon" aria-label="Próxima curiosidade" disabled={at === facts.length - 1} onClick={() => setAt(at + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  )
}
