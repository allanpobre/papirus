import { ArrowLeft, ArrowRight, CircleHelp, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PAGE_TOURS, type PageStep, type PageTourId } from '../shell/pageTours'
import { findTarget, placeCard } from './tourLayout'
import { useBackLayer } from './useBackLayer'

/**
 * O tour de uma tela só: destaca cada parte dela e diz para que serve. Não troca de
 * tela nem mexe em nada. Parte que não está na tela (lista vazia, celular) aparece no
 * centro, sem destaque; as marcadas como opcionais são puladas.
 */
export function PageTour({ title, steps: all, onClose }: { title: string; steps: PageStep[]; onClose: () => void }) {
  const [steps] = useState(() => all.filter((s) => !s.optional || findTarget(s.target)))
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const step = steps[index]
  const last = index === steps.length - 1
  // O "voltar" do aparelho fecha o tour.
  useBackLayer(onClose)

  const move = useCallback((d: 1 | -1) => setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + d))), [steps.length])

  // Leva o alvo para a tela e acompanha a rolagem e o tamanho da janela.
  useEffect(() => {
    const measure = () => {
      const el = findTarget(step.target)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    findTarget(step.target)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
    const frame = requestAnimationFrame(measure)
    addEventListener('resize', measure)
    addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', measure)
      removeEventListener('scroll', measure, true)
    }
  }, [step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
    nextRef.current?.focus()
  }, [index, rect])

  // Ao fechar, o foco volta para onde estava (o botão de ajuda), lido antes de o balão pegar o foco.
  const [before] = useState(() => document.activeElement as HTMLElement | null)
  useEffect(() => () => before?.focus?.(), [before])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight') {
        if (last) onClose()
        else move(1)
      } else if (e.key === 'ArrowLeft') move(-1)
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [last, move, onClose])

  const { width, ...pos } = placeCard(rect, cardH)
  const pad = 6

  return (
    <div className="tour page-tour" role="presentation">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ ...pos, width }}>
        <div className="tour-head">
          <span className="tour-count tabular">
            {title} · {index + 1} de {steps.length}
          </span>
          <button type="button" className="btn-icon btn-sm" aria-label="Fechar o tour desta tela" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          {index === 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(-1)}>
              <ArrowLeft size={14} /> Voltar
            </button>
          )}
          <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => (last ? onClose() : move(1))}>
            {last ? 'Entendi' : 'Próximo'} {!last && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

/** O botão (?) de uma tela: abre o tour só dela. */
export function PageHelp({ tour, className = '' }: { tour: PageTourId; className?: string }) {
  const [open, setOpen] = useState(false)
  const t = PAGE_TOURS[tour]
  return (
    <>
      <button type="button" className={`btn-icon page-help ${className}`.trim()} aria-label={`Como usar: ${t.title}`} title="Como usar esta tela" data-tour="ajuda" onClick={() => setOpen(true)}>
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      {/* No body: as telas entram com animação, e isso desloca o que é fixo dentro delas. */}
      {open && createPortal(<PageTour title={t.title} steps={t.steps} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
