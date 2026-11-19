import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { markSeen, NOVIDADES } from './novidades'

/** "O que mudou": as novidades do Papirus, a mais nova primeiro. Abrir marca como visto. */
export function NovidadesDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => markSeen(), [])
  return (
    <Modal title="O que mudou" onClose={onClose}>
      <div className="novidades">
        {NOVIDADES.map((n, i) => (
          <section key={n.id} className={`novidade${i === 0 ? ' is-new' : ''}`} aria-label={n.title}>
            <p className="tiny muted">{n.when}</p>
            <h3>
              {i === 0 && <Sparkles size={15} aria-hidden="true" />} {n.title}
            </h3>
            <ul>
              {n.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
