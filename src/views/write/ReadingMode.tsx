import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isDialogue } from '../../logic/doc'
import type { Scene } from '../../model/schema'
import { recall, remember } from '../../state/prefs'
import { Picture } from '../../images/Picture'

interface DocNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string }[]
  content?: DocNode[]
}

interface Block {
  sceneId: string
  key: string
  kind: 'titulo' | 'paragrafo' | 'separador' | 'citacao' | 'imagem'
  content: ReactNode
  plain: string
}

/** Converte o documento das cenas em blocos de leitura (sem o editor). */
function toBlocks(scenes: Scene[]): Block[] {
  const blocks: Block[] = []
  for (const s of scenes) {
    blocks.push({ sceneId: s.id, key: `${s.id}-t`, kind: 'titulo', content: s.title || 'Sem título', plain: s.title })
    ;((s.doc as DocNode).content ?? []).forEach((n, i) => {
      const key = `${s.id}-${i}`
      if (n.type === 'horizontalRule') blocks.push({ sceneId: s.id, key, kind: 'separador', content: '⁂', plain: '' })
      else if (n.type === 'image') blocks.push({ sceneId: s.id, key, kind: 'imagem', content: <Picture value={String(n.attrs?.src ?? '')} alt={String(n.attrs?.alt ?? '')} />, plain: '' })
      else {
        const plain = textOf(n)
        if (!plain.trim()) return
        blocks.push({ sceneId: s.id, key, kind: n.type === 'blockquote' ? 'citacao' : 'paragrafo', content: inline(n), plain })
      }
    })
  }
  return blocks
}

function textOf(n: DocNode): string {
  return n.text ?? (n.content ?? []).map(textOf).join(n.type === 'blockquote' ? '\n' : '')
}

function inline(n: DocNode): ReactNode {
  if (n.type === 'text') {
    let node: ReactNode = n.text
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') node = <strong>{node}</strong>
      else if (m.type === 'italic') node = <em>{node}</em>
      else if (m.type === 'strike') node = <s>{node}</s>
    }
    return node
  }
  if (n.type === 'hardBreak') return <br />
  return (n.content ?? []).map((c, i) => <span key={i}>{inline(c)}</span>)
}

/**
 * Leitura do manuscrito sem distrações. No ensaio, o texto aparece um parágrafo
 * por vez (espaço ou → avançam), para ouvir o ritmo das frases e das falas.
 * Marcadores ficam guardados neste navegador.
 */
export function ReadingMode({ title, scenes, startSceneId, onClose }: { title: string; scenes: Scene[]; startSceneId: string; onClose: () => void }) {
  const blocks = useMemo(() => toBlocks(scenes), [scenes])
  const [mode, setMode] = useState<'continua' | 'ensaio'>('continua')
  const [step, setStep] = useState(() => Math.max(0, blocks.findIndex((b) => b.sceneId === startSceneId)))
  const [marks, setMarks] = useState<Set<string>>(() => new Set(JSON.parse(recall('marcadores') ?? '[]') as string[]))
  const ref = useRef<HTMLDivElement>(null)
  const words = blocks.reduce((n, b) => n + (b.plain.match(/\S+/g)?.length ?? 0), 0)

  useEffect(() => {
    ref.current?.focus()
    const first = document.getElementById(`ler-${blocks[step]?.key}`)
    first?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'ensaio') document.getElementById(`ler-${blocks[step]?.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [mode, step, blocks])

  const toggleMark = (key: string) => {
    const next = new Set(marks)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setMarks(next)
    remember('marcadores', JSON.stringify([...next]))
  }

  const visible = mode === 'ensaio' ? blocks.slice(0, step + 1) : blocks
  const jumpMarks = blocks.map((b, i) => ({ b, i })).filter(({ b }) => marks.has(b.key))

  return (
    <div
      ref={ref}
      className="reading"
      role="dialog"
      aria-modal="true"
      aria-label={`Leitura: ${title}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        if (mode !== 'ensaio') return
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          setStep((s) => Math.min(blocks.length - 1, s + 1))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          setStep((s) => Math.max(0, s - 1))
        }
      }}
    >
      <header className="reading-bar">
        <span className="reading-title">{title}</span>
        <span className="muted small">{words.toLocaleString('pt-BR')} palavras · ~{Math.max(1, Math.round(words / 230))} min</span>
        <div className="segmented" role="radiogroup" aria-label="Modo de leitura">
          <button type="button" role="radio" aria-checked={mode === 'continua'} onClick={() => setMode('continua')}>
            Contínua
          </button>
          <button type="button" role="radio" aria-checked={mode === 'ensaio'} onClick={() => setMode('ensaio')}>
            Ensaio
          </button>
        </div>
        {jumpMarks.length > 0 && (
          <select
            className="input select input-sm"
            aria-label="Ir para marcador"
            value=""
            onChange={(e) => {
              const i = Number(e.target.value)
              setStep(i)
              document.getElementById(`ler-${blocks[i].key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }}
          >
            <option value="">Marcadores ({jumpMarks.length})</option>
            {jumpMarks.map(({ b, i }) => (
              <option key={b.key} value={i}>
                {b.plain.slice(0, 50)}…
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-icon" aria-label="Fechar leitura" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <div className="reading-scroll">
        <article className="reading-page">
          {visible.map((b, i) => {
            const current = mode === 'ensaio' && i === step
            if (b.kind === 'titulo') {
              return (
                <h2 key={b.key} id={`ler-${b.key}`} className="reading-scene-title">
                  {b.content}
                </h2>
              )
            }
            if (b.kind === 'separador') {
              return (
                <p key={b.key} id={`ler-${b.key}`} className="reading-break" aria-hidden="true">
                  ⁂
                </p>
              )
            }
            if (b.kind === 'imagem') {
              return (
                <figure key={b.key} id={`ler-${b.key}`} className="scene-figure">
                  {b.content}
                </figure>
              )
            }
            const Tag = b.kind === 'citacao' ? 'blockquote' : 'p'
            return (
              <div key={b.key} className={`reading-block${current ? ' current' : ''}${isDialogue(b.plain) ? ' dialogue' : ''}`}>
                <Tag id={`ler-${b.key}`}>{b.content}</Tag>
                <button
                  type="button"
                  className="reading-mark"
                  aria-pressed={marks.has(b.key)}
                  aria-label={marks.has(b.key) ? 'Remover marcador' : 'Marcar para voltar'}
                  onClick={() => toggleMark(b.key)}
                >
                  {marks.has(b.key) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                </button>
              </div>
            )
          })}
        </article>
      </div>

      {mode === 'ensaio' && (
        <footer className="reading-foot">
          <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft size={16} /> Voltar
          </button>
          <span className="reading-progress" aria-hidden="true">
            <span style={{ width: `${((step + 1) / blocks.length) * 100}%` }} />
          </span>
          <button type="button" className="btn btn-primary" disabled={step >= blocks.length - 1} onClick={() => setStep((s) => Math.min(blocks.length - 1, s + 1))}>
            Avançar <ChevronRight size={16} />
          </button>
        </footer>
      )}
    </div>
  )
}
