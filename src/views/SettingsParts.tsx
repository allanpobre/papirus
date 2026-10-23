import { Check, Cloud, LogIn } from 'lucide-react'
import { useState } from 'react'
import { AccountDialog } from '../account/AccountDialog'
import { useAccount } from '../account/auth'
import type { Accent } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

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
