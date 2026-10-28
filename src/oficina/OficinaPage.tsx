import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Coffee,
  Compass,
  Crown,
  Dices,
  Ghost,
  GraduationCap,
  Heart,
  Inbox,
  Layers,
  Lightbulb,
  MessagesSquare,
  PenLine,
  Rocket,
  Scissors,
  Search,
  Sparkles,
  UserRound,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { useBackLayer } from '../ui/useBackLayer'
import { GUIDES, sectionOf, tipOfTheDay, type Guide, type GuideId, type GuideSection } from './guides'
import { rollIdea, type Idea, type IdeaMode } from './ideas'
import { useOficinaSector } from './useOficinaSector'
import { exerciseKey, markRead, toggleDone, useOficinaProgress } from './progress'

/** Cor e ícone de cada gênero (a capa da Oficina e o topo de cada guia). */
const LOOK: Record<GuideId, { icon: LucideIcon; color: string }> = {
  fundamentos: { icon: PenLine, color: '#1d6b58' },
  fantasia: { icon: Wand2, color: '#7b5ea7' },
  ficcao: { icon: Rocket, color: '#2f6fae' },
  misterio: { icon: Search, color: '#4a5260' },
  romance: { icon: Heart, color: '#c0577a' },
  terror: { icon: Ghost, color: '#8a2f3b' },
  realismo: { icon: Coffee, color: '#a5762a' },
  personagem: { icon: UserRound, color: '#b8613c' },
  estrutura: { icon: Layers, color: '#3f6e9a' },
  dialogo: { icon: MessagesSquare, color: '#21857a' },
  ritmo: { icon: Activity, color: '#b0801a' },
  revisao: { icon: Scissors, color: '#6a5aa8' },
  mestrar: { icon: Crown, color: '#b81d3c' },
  aventuras: { icon: Compass, color: '#3d7a3a' },
}

/** As prateleiras, na ordem da capa, com o que cada uma oferece. */
const SECTIONS: { id: GuideSection; title: string; lede: string }[] = [
  { id: 'genero', title: 'Gêneros', lede: 'O que cada tipo de história promete ao leitor.' },
  { id: 'tecnica', title: 'Técnicas', lede: 'Ferramentas que valem para qualquer gênero.' },
  { id: 'mestre', title: 'Para mestres de RPG', lede: 'Preparar, conduzir e surpreender a mesa.' },
]

/** Os títulos de cada guia mudam com a prateleira (quem lê, quem escreve, quem joga). */
const HEADINGS: Record<GuideSection, { expect: string; exercises: string }> = {
  genero: { expect: 'O que o leitor espera', exercises: 'Experimente' },
  tecnica: { expect: 'Por que importa', exercises: 'Experimente' },
  mestre: { expect: 'O que a mesa espera', exercises: 'Para a próxima sessão' },
}

/**
 * A Oficina numa página própria, por cima de tudo: a capa com os gêneros e, ao escolher
 * um, o guia. O "voltar" do aparelho volta para a capa e depois fecha.
 */
export function OficinaPage({
  genre,
  start,
  onClose,
  onPractice,
  onKeep,
}: {
  genre?: GuideId
  /** Abre direto neste gênero (a capa já está atrás, no início do app): voltar fecha. */
  start?: GuideId
  onClose: () => void
  onPractice?: (title: string, prompt: string) => void
  /** Guarda uma ideia do gerador nas Ideias do universo. */
  onKeep?: (text: string) => void
}) {
  const [open, setOpen] = useState<GuideId | null>(start ?? null)
  const scroller = useRef<HTMLDivElement>(null)

  // A Oficina e o gênero aberto são passos do "voltar" do aparelho: volta para a capa e depois fecha.
  useBackLayer(onClose)
  useOficinaSector()
  useBackLayer(() => setOpen(null), open !== null && !start)

  // Corpo com chaves: algumas extensões fazem scrollTo devolver um número, e o React
  // tentaria chamar esse número como limpeza do efeito ("1 is not a function").
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [open])

  const choose = (id: GuideId) => setOpen(id)
  const back = () => (start ? onClose() : setOpen(null))
  const close = () => onClose()
  // Esc fecha (ou volta para a capa, se estiver num gênero).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open && !start) setOpen(null)
      else onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose, start])

  const guide = open ? GUIDES.find((g) => g.id === open) : null
  return createPortal(
    <div className="oficina-page" role="dialog" aria-modal="true" aria-label="Oficina">
      <div className="oficina-scroll" ref={scroller}>
        <header className="oficina-top">
          {guide ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={back}>
              <ArrowLeft size={16} /> {start ? 'Voltar' : 'Todos os gêneros'}
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
        <ErrorBoundary key={open ?? 'capa'} label="A Oficina não conseguiu abrir esta página." onReset={back}>
        {guide ? (
          <GuidePage
            key={guide.id}
            guide={guide}
            onPractice={
              onPractice &&
              ((title, prompt) => {
                close()
                // Depois que a Oficina sai do histórico, a cena nova entra como o passo seguinte.
                setTimeout(() => onPractice(title, prompt), 0)
              })
            }
          />
        ) : (
          <OficinaCover
            genre={genre}
            onChoose={choose}
            onKeep={onKeep}
            onPractice={
              onPractice &&
              ((title, prompt) => {
                close()
                setTimeout(() => onPractice(title, prompt), 0)
              })
            }
          />
        )}
        </ErrorBoundary>
      </div>
    </div>,
    document.body,
  )
}

export function OficinaCover({
  genre,
  onChoose,
  onPractice,
  onKeep,
}: {
  genre?: GuideId
  onChoose: (id: GuideId) => void
  /** Transforma a ideia sorteada numa cena (só dentro de um universo). */
  onPractice?: (title: string, prompt: string) => void
  onKeep?: (text: string) => void
}) {
  const [tip] = useState(() => tipOfTheDay(genre ?? 'fundamentos'))
  const progress = useOficinaProgress()
  // A etiqueta só aparece quando dá para saber o gênero do universo.
  const mine = genre && genre !== 'fundamentos' ? genre : null
  const forTable = genre === 'mestrar' || genre === 'aventuras'
  // Numa campanha, os guias da mesa vêm primeiro.
  const sections = forTable ? [SECTIONS[2], SECTIONS[0], SECTIONS[1]] : SECTIONS
  const doneIn = (g: Guide) => g.exercises.filter((e) => progress.done.includes(exerciseKey(g.id, e.title))).length
  const readCount = GUIDES.filter((g) => progress.read.includes(g.id)).length
  let i = 0
  return (
    <div className="oficina-cover">
      <section className="oficina-hero">
        <p className="oficina-kicker">Oficina</p>
        <h1 className="oficina-hero-title">{forTable ? 'Escrever, mestrar e aprender um pouco por dia.' : 'Escrever melhor, um passo de cada vez.'}</h1>
        <p className="oficina-hero-lede">Gêneros, técnicas e guias para mestres: dicas, armadilhas, livros para estudar, curiosidades e exercícios.</p>
        {readCount > 0 && (
          <p className="oficina-progress" role="status">
            <Check size={14} aria-hidden="true" /> {readCount} de {GUIDES.length} guias abertos · {progress.done.length} {progress.done.length === 1 ? 'exercício feito' : 'exercícios feitos'}
          </p>
        )}
      </section>

      <button type="button" className="oficina-tip" style={{ '--g': LOOK[tip.guide.id].color } as React.CSSProperties} onClick={() => onChoose(tip.guide.id)}>
        <span className="oficina-tip-kicker">
          <Lightbulb size={14} aria-hidden="true" /> Dica do dia · {tip.guide.label}
        </span>
        <span className="oficina-tip-title">{tip.title}</span>
        <span className="oficina-tip-text">{tip.text}</span>
      </button>

      <IdeaGenerator initial={forTable ? 'mesa' : 'escrita'} onPractice={onPractice} onKeep={onKeep} />

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

/** Sorteia uma premissa (para escrever) ou um gancho (para a mesa). */
function IdeaGenerator({ initial, onPractice, onKeep }: { initial: IdeaMode; onPractice?: (title: string, prompt: string) => void; onKeep?: (text: string) => void }) {
  const [mode, setMode] = useState<IdeaMode>(initial)
  const [idea, setIdea] = useState<Idea>(() => rollIdea(initial))
  const [spin, setSpin] = useState(0)
  const [kept, setKept] = useState(false)
  const roll = (m = mode) => {
    setIdea(rollIdea(m))
    setSpin((n) => n + 1)
    setKept(false)
  }
  return (
    <section className="oficina-ideas" aria-labelledby="oficina-ideias">
      <div className="oficina-ideas-top">
        <h2 className="oficina-h" id="oficina-ideias">
          <Sparkles size={18} aria-hidden="true" /> Gerador de ideias
        </h2>
        <div className="segmented" role="radiogroup" aria-label="Ideia para">
          {(
            [
              ['escrita', 'Para escrever'],
              ['mesa', 'Para a mesa'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m)
                roll(m)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <dl key={spin} className="oficina-idea" aria-live="polite">
        {idea.parts.map((p, n) => (
          <div key={p.label} style={{ '--i': n } as React.CSSProperties}>
            <dt>{p.label}</dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>
      <div className="oficina-ideas-actions">
        <button type="button" className="btn btn-sm" onClick={() => roll()}>
          <Dices size={15} className={spin ? 'oficina-dice' : undefined} key={spin} /> Outra ideia
        </button>
        {mode === 'escrita' && onPractice && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onPractice('Ideia sorteada', idea.sentence)}>
            <PenLine size={15} /> Escrever esta ideia
          </button>
        )}
        {onKeep && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={kept}
            onClick={() => {
              onKeep(idea.sentence)
              setKept(true)
            }}
          >
            {kept ? <Check size={15} /> : <Inbox size={15} />} {kept ? 'Guardada em Ideias' : 'Guardar em Ideias'}
          </button>
        )}
      </div>
    </section>
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
  const section = sectionOf(guide)
  const headings = HEADINGS[section]
  const progress = useOficinaProgress()
  // Abrir o guia já conta como lido.
  useEffect(() => markRead(guide.id), [guide.id])
  // Exercícios de mestre são para a mesa, não viram cena.
  const practice = section === 'mestre' ? undefined : onPractice
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
        <span>{headings.expect}</span>
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
          <Lightbulb size={18} aria-hidden="true" /> {headings.exercises}
        </h2>
        <ul className="oficina-ex">
          {guide.exercises.map((e, i) => {
            const key = exerciseKey(guide.id, e.title)
            const done = progress.done.includes(key)
            return (
              <li key={e.title} data-reveal className={done ? 'is-done' : undefined} style={{ '--i': i } as React.CSSProperties}>
                <strong>{e.title}</strong>
                <p>{e.prompt}</p>
                <div className="oficina-ex-actions">
                  {practice ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => practice(e.title, e.prompt)}>
                      <PenLine size={14} /> Escrever este exercício
                    </button>
                  ) : (
                    section !== 'mestre' && <span className="muted tiny">Abra um universo para transformar o exercício numa cena.</span>
                  )}
                  <button type="button" className={`btn btn-sm btn-ghost oficina-done-btn${done ? ' is-on' : ''}`} aria-pressed={done} onClick={() => toggleDone(key)}>
                    <Check size={14} /> {done ? 'Feito' : 'Marcar como feito'}
                  </button>
                </div>
              </li>
            )
          })}
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
