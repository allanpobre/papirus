import { Check, Cloud, LogIn } from 'lucide-react'
import { useState } from 'react'
import { AccountDialog } from '../account/AccountDialog'
import { useAccount } from '../account/auth'
import type { Accent } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { ENTITY_KINDS } from '../model/schema'
import { kindLabel } from '../model/labels'

const ACCENTS: { id: Accent; label: string }[] = [
  { id: 'viridiana', label: 'Viridiana' },
  { id: 'azul', label: 'Azul' },
  { id: 'vinho', label: 'Vinho' },
  { id: 'violeta', label: 'Violeta' },
  { id: 'ocre', label: 'Ocre' },
  { id: 'grafite', label: 'Grafite' },
]

/** Cor de destaque: botões, links, item ativo do menu. */
export function AccentPicker({ value, onChange }: { value: Accent; onChange: (v: Accent) => void }) {
  return (
    <fieldset className="accent-picker">
      <legend className="field-label">Cor de destaque</legend>
      <div className="accent-options" role="radiogroup" aria-label="Cor de destaque">
        {ACCENTS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={value === a.id} className={`accent-option accent-${a.id}`} onClick={() => onChange(a.id)}>
            <span className="accent-swatch" aria-hidden="true">
              {value === a.id && <Check size={14} />}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Resumo da conta dentro dos Ajustes. */
export function AccountCard() {
  const { library, prefs, setPref } = useWorkspace()
  const { user } = useAccount()
  const [open, setOpen] = useState(false)
  return (
    <section className="settings-card">
      <h2 className="section-title">Conta</h2>
      {user ? (
        <p className="small">
          <Cloud size={14} aria-hidden="true" /> Conectado como <strong>{user.email}</strong>. Seus universos também ficam na nuvem.
        </p>
      ) : (
        <p className="small">Sem conta, tudo fica neste navegador. Com uma conta (opcional), seus universos aparecem em todos os seus aparelhos.</p>
      )}
      <div className="inline-fields">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          {user ? <Cloud size={14} /> : <LogIn size={14} />} {user ? 'Ver a conta' : 'Entrar ou criar conta'}
        </button>
      </div>
      {open && <AccountDialog library={library} prefs={prefs} setPref={setPref} onClose={() => setOpen(false)} />}
    </section>
  )
}

/** Campos sugeridos por tipo de ficha: toda ficha nova do tipo já nasce com eles. */
export function FieldTemplatesCard() {
  const { universe, update } = useWorkspace()
  const templates = universe.settings.fieldTemplates ?? {}
  const kinds = [...new Set([...ENTITY_KINDS, ...universe.entities.map((e) => e.kind), ...Object.keys(templates)])]
  const setKind = (kind: string, text: string) =>
    update((u) => {
      const list = text
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      const next = { ...(u.settings.fieldTemplates ?? {}) }
      if (list.length) next[kind] = list
      else delete next[kind]
      return { ...u, settings: { ...u.settings, fieldTemplates: next }, updatedAt: new Date().toISOString() }
    })
  return (
    <section className="settings-card">
      <h2 className="section-title">Campos sugeridos nas fichas</h2>
      <p className="muted small">Toda ficha nova do tipo já nasce com estes campos, vazios. Separe por vírgula. Fichas que já existem não mudam.</p>
      <div className="field-templates">
        {kinds.map((k) => (
          <label key={k} className="field-template-row">
            <span className="field-label">{kindLabel(k)}</span>
            <FieldTemplateInput value={(templates[k] ?? []).join(', ')} onCommit={(v) => setKind(k, v)} placeholder="Ex.: Idade, Objetivo, Medo" />
          </label>
        ))}
      </div>
    </section>
  )
}

/** Guarda ao sair do campo (enquanto digita, vírgulas soltas não viram campos vazios). */
function FieldTemplateInput({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className="input"
      value={draft ?? value}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
      }}
    />
  )
}
