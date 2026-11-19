import type { LucideIcon } from 'lucide-react'

/** Um item de menu com ícone, nome e uma frase do que faz (para os menus "⋯" não serem só ícones soltos). */
export function MenuItem({ icon: Icon, title, hint, onClick, pressed, danger }: { icon: LucideIcon; title: string; hint?: string; onClick: () => void; pressed?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`menu-item${danger ? ' is-danger' : ''}`} aria-pressed={pressed} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  )
}

/** O nome de um grupo dentro do menu ("Editar", "Ver", "Cuidado"). */
export const MenuGroup = ({ children }: { children: string }) => <p className="menu-group-label">{children}</p>
