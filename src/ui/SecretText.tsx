import { BookOpen, BookOpenCheck, Lock, LockOpen } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { markAt, markSegments, unwrapMark } from '../logic/marks'
import { revealIndex, splitReveals, wrapReveal } from '../logic/reveals'
import { countSecrets, splitSecrets, wrapSecret } from '../logic/secrets'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/**
 * Texto livre com trechos secretos e spoilers. As marcas ficam no texto (é assim que ele é
 * guardado), mas o campo as mostra apagadas e pinta o trecho: quem escreve vê o que é
 * segredo, não código. Com o cursor dentro de um trecho, o botão passa a tirar a marca.
 */
export function SecretTextarea({ id, value, onChange, rows = 8, placeholder }: { id: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const count = countSecrets(value)
  const { universe } = useWorkspace()
  const order = manuscriptOrder(universe)
  const [picking, setPicking] = useState(false)
  const [caret, setCaret] = useState<number | null>(null)
  const reveals = splitReveals(value).filter((p) => p.sceneTitle !== null)
  const segments = useMemo(() => markSegments(value), [value])
  const inSecret = caret === null ? undefined : markAt(value, caret, 'secret')
  const inReveal = caret === null ? undefined : markAt(value, caret, 'reveal')
  // O campo cresce com o texto: sem rolagem dentro dele, o destaque fica alinhado com as letras.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [value])
  const keepCursor = (cursor: number) =>
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(cursor, cursor)
      setCaret(cursor)
    })
  const apply = ({ text, cursor }: { text: string; cursor: number }) => {
    onChange(text)
    keepCursor(cursor)
  }
  const track = () => {
    const el = ref.current
    if (el) setCaret(el.selectionStart === el.selectionEnd ? el.selectionStart : null)
  }
  return (
    <div className="secret-text">
      <div className="marked-field">
        <div ref={back} className="input textarea textarea-prose marked-backdrop" aria-hidden="true">
          {segments.map((p, i) => (
            <span key={i} className={[p.tag && 'mk-tag', p.secret && 'mk-secret', p.reveal && 'mk-reveal'].filter(Boolean).join(' ') || undefined}>
              {p.text}
            </span>
          ))}
          {/* O espaço da última linha, quando o texto termina em quebra. */}
          {'\u200b'}
        </div>
        <textarea
          ref={ref}
          id={id}
          className="input textarea textarea-prose marked-input"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            track()
          }}
          onSelect={track}
          onBlur={() => setTimeout(() => document.activeElement !== ref.current && setCaret(null), 200)}
          onScroll={() => back.current && (back.current.scrollTop = ref.current?.scrollTop ?? 0)}
        />
      </div>
      <div className="secret-bar">
        {inSecret ? (
          <button type="button" className="btn btn-ghost btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(unwrapMark(value, inSecret))}>
            <LockOpen size={14} /> Deixar de ser segredo
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Só você vê. O Codex dos jogadores nunca mostra; a IA (Perguntar ao mundo) só recebe se você pedir."
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const el = ref.current
              if (el) apply(wrapSecret(value, el.selectionStart, el.selectionEnd))
            }}
          >
            <Lock size={14} /> Marcar seleção como segredo
          </button>
        )}
        {inReveal ? (
          <button type="button" className="btn btn-ghost btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(unwrapMark(value, inReveal))}>
            <BookOpen size={14} /> Mostrar desde o começo
          </button>
        ) : (
          order.length > 0 &&
          (picking ? (
            <select
              className="input input-sm"
              aria-label="Revelar ao leitor a partir de qual cena"
              autoFocus
              defaultValue=""
              onBlur={() => setPicking(false)}
              onChange={(e) => {
                const scene = order.find((s) => s.id === e.target.value)
                const el = ref.current
                setPicking(false)
                if (scene && el) apply(wrapReveal(value, el.selectionStart, el.selectionEnd, scene))
              }}
            >
              <option value="" disabled>
                A partir de qual cena?
              </option>
              {order.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.title || 'Sem título'}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Spoiler: no modo leitor, este trecho só aparece depois que o leitor chega à cena escolhida."
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPicking(true)}
            >
              <BookOpenCheck size={14} /> Revelar a partir de…
            </button>
          ))
        )}
        {count > 0 && (
          <span className="muted tiny">
            <span className="mk-legend mk-secret" aria-hidden="true" /> {count} {count === 1 ? 'trecho secreto' : 'trechos secretos'}: ficam fora do Codex dos jogadores
          </span>
        )}
      </div>
      {reveals.length > 0 && (
        <ul className="reveal-list">
          {reveals.map((p, i) => {
            const at = revealIndex(p, order)
            return (
              <li key={i} className={at === null ? 'reveal-missing' : undefined}>
                <BookOpenCheck size={13} aria-hidden="true" />
                <span>
                  {at === null ? (
                    <>Cena “{p.sceneTitle}” não encontrada: o trecho fica escondido do leitor</>
                  ) : (
                    <>
                      O leitor vê a partir da cena {at + 1}, “{order[at].title || 'Sem título'}”
                    </>
                  )}
                  : <em>{p.text.trim().slice(0, 80) || '(vazio)'}</em>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Mostra um texto com os trechos secretos destacados (visão do autor). */
export function SecretAwareText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {splitSecrets(text).map((p, i) =>
        p.secret ? (
          <mark key={i} className="secret-mark" title="Trecho secreto">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}
