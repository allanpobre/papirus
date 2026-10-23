import { Lock } from 'lucide-react'
import { useRef } from 'react'
import { countSecrets, splitSecrets, wrapSecret } from '../logic/secrets'

/** Texto livre com trechos secretos: botão para marcar a seleção e contador. */
export function SecretTextarea({ id, value, onChange, rows = 8, placeholder }: { id: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const count = countSecrets(value)
  return (
    <div className="secret-text">
      <textarea ref={ref} id={id} className="input textarea textarea-prose" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <div className="secret-bar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Só você vê. O Codex dos jogadores nunca mostra; o Archivist só recebe se você pedir."
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
        {count > 0 && (
          <span className="muted tiny">
            {count} {count === 1 ? 'trecho secreto' : 'trechos secretos'}: ficam fora do Codex dos jogadores
          </span>
        )}
      </div>
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
