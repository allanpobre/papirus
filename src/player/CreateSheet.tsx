import { Send } from 'lucide-react'
import { useState } from 'react'
import { fold } from '../logic/text'
import type { TableSheet } from '../share/server'
import type { CodexSnapshot } from '../share/snapshot'
import { Modal } from '../ui/Modal'

type Form = NonNullable<CodexSnapshot['create']>

/**
 * O jogador cria o próprio personagem pelo convite: o nome, quem joga, e os atributos e campos do
 * sistema do grupo. Vai para o Papirus do mestre, que guarda a ficha; o resto (perícias, ataques,
 * itens) o mestre completa depois.
 */
export function CreateSheetDialog({ form, taken, onSend, onClose }: { form: Form; taken: string[]; onSend: (s: TableSheet) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [player, setPlayer] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [attrs, setAttrs] = useState<Record<string, number>>(() => Object.fromEntries(form.attrs.map((a) => [a.id, a.def])))
  const repeated = Boolean(name.trim()) && taken.some((t) => fold(t) === fold(name))

  return (
    <Modal title="Criar o meu personagem" onClose={onClose} size="sm">
      <form
        className="player-create"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || repeated) return
          onSend({
            id: crypto.randomUUID(),
            name: name.trim(),
            player: player.trim(),
            fields: form.fields.map((f): [string, string] => [f, (fields[f] ?? '').trim()]).filter(([, v]) => v),
            attrs: form.attrs.map((a): [string, number] => [a.id, Math.min(a.max, Math.max(a.min, Math.round(attrs[a.id] ?? a.def)))]),
          })
        }}
      >
        <label className="field">
          <span className="field-label">Nome do personagem</span>
          <input className="input" autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-describedby={repeated ? 'ficha-repetida' : undefined} />
        </label>
        {repeated && (
          <p id="ficha-repetida" className="small player-create-warn" role="alert">
            Já há um personagem com esse nome nesta mesa. Se é o seu, feche e escolha-o na lista.
          </p>
        )}
        <label className="field">
          <span className="field-label">Seu nome</span>
          <input className="input" maxLength={60} value={player} placeholder="Como o grupo te chama" onChange={(e) => setPlayer(e.target.value)} />
        </label>
        {form.fields.map((f) => (
          <label key={f} className="field">
            <span className="field-label">{f}</span>
            <input className="input" maxLength={120} value={fields[f] ?? ''} onChange={(e) => setFields((v) => ({ ...v, [f]: e.target.value }))} />
          </label>
        ))}
        {form.attrs.length > 0 && (
          <fieldset className="player-create-attrs">
            <legend className="field-label">Atributos</legend>
            {form.attrs.map((a) => (
              <label key={a.id} title={a.name}>
                <span>{a.abbr || a.name}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  aria-label={a.name}
                  min={a.min}
                  max={a.max}
                  value={attrs[a.id] ?? a.def}
                  onChange={(e) => setAttrs((v) => ({ ...v, [a.id]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </fieldset>
        )}
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || repeated}>
          <Send size={16} aria-hidden="true" /> Enviar ao mestre
        </button>
        <p className="tiny muted">A ficha vai para o Papirus do mestre e aparece aqui quando ele receber. Perícias, ataques e itens, o mestre completa com você.</p>
      </form>
    </Modal>
  )
}
