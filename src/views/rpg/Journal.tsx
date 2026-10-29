import { BookOpen, Wand2 } from 'lucide-react'
import type { Session } from '../../model/schema'
import { patch } from '../../model/universe'
import { draftRecap } from '../../rpg/sessionLife'
import { useWorkspace } from '../../state/workspace'

/**
 * O resumo da sessão para os jogadores: o mestre escreve (ou começa pelas notas do registro)
 * e publica no Codex, no diário da campanha. Só vai o que estiver escrito aqui.
 */
export function RecapEditor({ session: s }: { session: Session }) {
  const { update, readOnly } = useWorkspace()
  const set = (c: Partial<Session>) => update((u) => patch(u, 'sessions', s.id, c))
  const draft = draftRecap(s)
  const id = `resumo-${s.id}`

  return (
    <div className="recap">
      <label htmlFor={id} className="field-label">
        Resumo para os jogadores
      </label>
      <textarea
        id={id}
        className="input textarea"
        rows={5}
        readOnly={readOnly}
        placeholder="O que os personagens viveram nesta sessão, do jeito que eles sabem. Segredos ficam de fora: só vai o que você escrever aqui."
        value={s.recap}
        onChange={(e) => set({ recap: e.target.value })}
      />
      <div className="inline-fields recap-acts">
        {!readOnly && !s.recap.trim() && draft && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ recap: draft })}>
            <Wand2 size={14} /> Começar pelas notas do registro
          </button>
        )}
        <label className="toggle">
          <input type="checkbox" role="switch" checked={s.recapShared} disabled={readOnly || !s.recap.trim()} onChange={(e) => set({ recapShared: e.target.checked })} />
          <span className="toggle-track" aria-hidden="true" />
          <span>Publicar no diário do Codex</span>
        </label>
      </div>
      <p className="muted tiny">
        <BookOpen size={12} aria-hidden="true" /> {s.recapShared && s.recap.trim() ? 'No Codex dos jogadores, no diário da campanha.' : 'Só você vê, até publicar.'}
      </p>
    </div>
  )
}
