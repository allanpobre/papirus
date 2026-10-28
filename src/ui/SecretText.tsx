import { BookOpenCheck, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { revealIndex, splitReveals, wrapReveal } from '../logic/reveals'
import { countSecrets, splitSecrets, wrapSecret } from '../logic/secrets'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/** Texto livre com trechos secretos: botão para marcar a seleção e contador. */
export function SecretTextarea({ id, value, onChange, rows = 8, placeholder }: { id: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const count = countSecrets(value)
  const { universe } = useWorkspace()
  const order = manuscriptOrder(universe)
  const [picking, setPicking] = useState(false)
  const reveals = splitReveals(value).filter((p) => p.sceneTitle !== null)
  const keepCursor = (cursor: number) =>
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(cursor, cursor)
    })
  return (
    <div className="secret-text">
      <textarea ref={ref} id={id} className="input textarea textarea-prose" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <div className="secret-bar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Só você vê. O Codex dos jogadores nunca mostra; a IA (Perguntar ao mundo) só recebe se você pedir."
          onClick={() => {
            const el = ref.current
            if (!el) return
            const { text, cursor } = wrapSecret(value, el.selectionStart, el.selectionEnd)
            onChange(text)
            requestAnimationFrame(() => {
              el.focus()
              el.setSelectionRange(cursor, cursor)
            })
          }}
        >
          <Lock size={14} /> Marcar seleção como segredo
        </button>
        {order.length > 0 &&
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
                if (!scene || !el) return
                const { text, cursor } = wrapReveal(value, el.selectionStart, el.selectionEnd, scene)
                onChange(text)
                keepCursor(cursor)
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
          ))}
        {count > 0 && (
          <span className="muted tiny">
            {count} {count === 1 ? 'trecho secreto' : 'trechos secretos'}: ficam fora do Codex dos jogadores
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
