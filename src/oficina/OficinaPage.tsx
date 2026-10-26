import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Coffee, Ghost, GraduationCap, Heart, Lightbulb, PenLine, Rocket, Search, Sparkles, Wand2, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { GUIDES, tipOfTheDay, type Guide, type GuideId } from './guides'

/** Cor e ícone de cada gênero (a capa da Oficina e o topo de cada guia). */
const LOOK: Record<GuideId, { icon: LucideIcon; color: string }> = {
  fundamentos: { icon: PenLine, color: '#1d6b58' },
  fantasia: { icon: Wand2, color: '#7b5ea7' },
  ficcao: { icon: Rocket, color: '#2f6fae' },
  misterio: { icon: Search, color: '#4a5260' },
  romance: { icon: Heart, color: '#c0577a' },
  terror: { icon: Ghost, color: '#8a2f3b' },
  realismo: { icon: Coffee, color: '#a5762a' },
}

/**
 * A Oficina numa página própria, por cima de tudo: a capa com os gêneros e, ao escolher
 * um, o guia. O "voltar" do celular volta para a capa e depois fecha.
 */
export function OficinaPage({ genre, onClose, onPractice }: { genre?: GuideId; onClose: () => void; onPractice?: (title: string, prompt: string) => void }) {
  const [open, setOpen] = useState<GuideId | null>(null)
  const depth = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)

  // Cada passo vira uma entrada no histórico: o "voltar" do aparelho funciona.
  useEffect(() => {
    // Uma entrada só (o modo de desenvolvimento roda este efeito duas vezes).
    const st = history.state as { oficina?: unknown } | null
    if (!st || !('oficina' in st)) history.pushState({ oficina: null }, '')
    depth.current = 1
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { oficina?: GuideId | null } | null
      if (st && 'oficina' in st) {
        depth.current = st.oficina ? 2 : 1
        setOpen(st.oficina ?? null)
      } else {
        depth.current = 0
        onClose()
      }
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [onClose])

  // Corpo com chaves: algumas extensões fazem scrollTo devolver um número, e o React
  // tentaria chamar esse número como limpeza do efeito ("1 is not a function").
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [open])

  const choose = (id: GuideId) => {
    history.pushState({ oficina: id }, '')
    depth.current = 2
    setOpen(id)
  }
  const back = () => history.back()
  const close = () => (depth.current > 0 ? history.go(-depth.current) : onClose())
  // Esc fecha (ou volta para a capa, se estiver num gênero).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') history.back()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const guide = open ? GUIDES.find((g) => g.id === open) : null
  return createPortal(
    <div className="oficina-page" role="dialog" aria-modal="true" aria-label="Oficina">
      <div className="oficina-scroll" ref={scroller}>
        <header className="oficina-top">
          {guide ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={back}>
              <ArrowLeft size={16} /> Todos os gêneros
            </button>
          ) : (
            <span className="oficina-brand">
              <GraduationCap size={18} aria-hidden="true" /> Oficina
            </span>
          )}
          <button type="button" className="btn-icon" aria-label="Fechar a Oficina" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <ErrorBoundary key={open ?? 'capa'} label="A Oficina não conseguiu abrir esta página." onReset={() => history.back()}>
        {guide ? (
          <GuidePage
            key={guide.id}
            guide={guide}
            onPractice={
              onPractice &&
              ((title, prompt) => {
                onPractice(title, prompt)
                close()
              })
            }
          />
        ) : (
          <Cover genre={genre} onChoose={choose} />
        )}
        </ErrorBoundary>
      </div>
    </div>,
    document.body,
  )
}

function Cover({ genre, onChoose }: { genre?: GuideId; onChoose: (id: GuideId) => void }) {
  const [tip] = useState(() => tipOfTheDay(genre ?? 'fundamentos'))
  // A etiqueta só aparece quando dá para saber o gênero do universo.
  const mine = genre && genre !== 'fundamentos' ? genre : null
  return (
    <div className="oficina-cover">
      <section className="oficina-hero">
        <p className="oficina-kicker">Oficina de escrita</p>
        <h1 className="oficina-hero-title">Escrever melhor, um gênero de cada vez.</h1>
        <p className="oficina-hero-lede">Dicas, armadilhas, livros para estudar, curiosidades e exercícios que viram cena.</p>
      </section>

      <button type="button" className="oficina-tip" style={{ '--g': LOOK[tip.guide.id].color } as React.CSSProperties} onClick={() => onChoose(tip.guide.id)}>
        <span className="oficina-tip-kicker">
          <Lightbulb size={14} aria-hidden="true" /> Dica do dia · {tip.guide.label}
        </span>
        <span className="oficina-tip-title">{tip.title}</span>
        <span className="oficina-tip-text">{tip.text}</span>
      </button>

      <h2 className="oficina-h">Escolha um gênero</h2>
      <ul className="oficina-genres">
        {GUIDES.map((g, i) => {
          const { icon: Icon, color } = LOOK[g.id]
          return (
            <li key={g.id} style={{ '--g': color, '--i': i } as React.CSSProperties}>
              <button type="button" className={`oficina-genre${g.id === mine ? ' is-mine' : ''}`} onClick={() => onChoose(g.id)}>
                <span className="oficina-genre-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span className="oficina-genre-name">{g.label}</span>
                <span className="oficina-genre-lede">{g.lede}</span>
                {g.id === mine && <span className="oficina-genre-tag">o seu universo</span>}
                <ArrowRight size={16} className="oficina-genre-go" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
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

function GuidePage({ guide, onPractice }: { guide: Guide; onPractice?: (title: string, prompt: string) => void }) {
  const { icon: Icon, color } = LOOK[guide.id]
  const ref = useReveal()
  return (
    <article className="oficina-guide-page" ref={ref} style={{ '--g': color } as React.CSSProperties}>
      <header className="oficina-guide-hero">
        <span className="oficina-guide-icon" aria-hidden="true">
          <Icon size={30} />
        </span>
        <h1>{guide.label}</h1>
        <p>{guide.lede}</p>
      </header>

      <p className="oficina-expect-big" data-reveal>
        <span>O que o leitor espera</span>
        {guide.expect}
      </p>

      <section aria-labelledby="of-funciona" className="oficina-block">
        <h2 id="of-funciona" className="oficina-h" data-reveal>
          O que funciona
        </h2>
        <ol className="oficina-works">
          {guide.works.map((w, i) => (
            <li key={w.title} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <span className="oficina-num" aria-hidden="true">
                {i + 1}
              </span>
              <strong>{w.title}</strong>
              <p>{w.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="of-armadilhas" className="oficina-block">
        <h2 id="of-armadilhas" className="oficina-h" data-reveal>
          <AlertTriangle size={18} aria-hidden="true" /> Armadilhas comuns
        </h2>
        <ul className="oficina-traps-big">
          {guide.traps.map((t, i) => (
            <li key={t} data-reveal style={{ '--i': i } as React.CSSProperties}>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="of-livros" className="oficina-block">
        <h2 id="of-livros" className="oficina-h" data-reveal>
          <BookOpen size={18} aria-hidden="true" /> Livros para estudar
        </h2>
        <ul className="oficina-shelf">
          {guide.books.map((b, i) => (
            <li key={b.title} data-reveal style={{ '--i': i } as React.CSSProperties}>
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
      </section>

      <section aria-labelledby="of-curiosidades" className="oficina-block">
        <h2 id="of-curiosidades" className="oficina-h" data-reveal>
          <Sparkles size={18} aria-hidden="true" /> Curiosidades
        </h2>
        <p className="muted small" data-reveal>
          Toque numa carta para virar.
        </p>
        <ul className="oficina-facts-grid">
          {guide.facts.map((f, i) => (
            <li key={f} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <FactCard n={i + 1} text={f} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="of-exercicios" className="oficina-block">
        <h2 id="of-exercicios" className="oficina-h" data-reveal>
          <Lightbulb size={18} aria-hidden="true" /> Experimente
        </h2>
        <ul className="oficina-ex">
          {guide.exercises.map((e, i) => (
            <li key={e.title} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <strong>{e.title}</strong>
              <p>{e.prompt}</p>
              {onPractice ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onPractice(e.title, e.prompt)}>
                  <PenLine size={14} /> Escrever este exercício
                </button>
              ) : (
                <span className="muted tiny">Abra um universo para transformar o exercício numa cena.</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

function FactCard({ n, text }: { n: number; text: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button type="button" className={`oficina-fact${flipped ? ' is-flipped' : ''}`} aria-pressed={flipped} aria-label={flipped ? text : `Você sabia? Curiosidade ${n}`} onClick={() => setFlipped(!flipped)}>
      <span className="oficina-fact-inner" aria-hidden="true">
        <span className="oficina-fact-front">
          <Sparkles size={20} />
          <span>Você sabia?</span>
          <span className="oficina-fact-n">{n}</span>
        </span>
        <span className="oficina-fact-back">{text}</span>
      </span>
    </button>
  )
}
