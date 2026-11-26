import { Modal } from '../ui/Modal'
import { SHORTCUTS } from './keys'

/** A lista dos atalhos (na janela do “?” e no Guia). */
export function ShortcutList() {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <ul className="shortcut-list">
      {SHORTCUTS.map((s) => (
        <li key={s.what}>
          <span className="shortcut-keys">
            {s.keys.map((k, i) => (
              <kbd key={i} className="kbd">
                {mac && k === 'Ctrl' ? '⌘' : k}
              </kbd>
            ))}
          </span>
          <span className="small">{s.what}</span>
        </li>
      ))}
    </ul>
  )
}

/** “?”: os atalhos de teclado do Papirus. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Atalhos de teclado" about="As teclas de uma letra só valem fora de campos de texto: nunca atrapalham quem escreve." onClose={onClose} size="sm">
      <ShortcutList />
    </Modal>
  )
}
