import { ChevronRight } from 'lucide-react'
import { worldLevel } from '../model/kind'
import { allTools } from '../shell/toolsList'
import { useWorkspace } from '../state/workspace'

/** "Todas as ferramentas": cada área com uma frase e um toque para abrir. Ajuda a achar o que o menu "Mais" esconde. */
export function AllTools() {
  const { go, hiddenViews, universe } = useWorkspace()
  const rows = allTools(hiddenViews, worldLevel(universe) === 'simples')
  return (
    <section className="card settings-card all-tools" aria-labelledby="todas-ferramentas">
      <h2 className="sr-only" id="todas-ferramentas">
        Todas as ferramentas
      </h2>
      <p className="muted small">Cada área do Papirus, com o que ela faz. Toque para abrir.</p>
      <ul className="all-tools-list">
        {rows.map(({ item, hint, hiddenBecause }) => {
          const Icon = item.icon
          return (
            <li key={item.view}>
              <button type="button" className="all-tools-row" onClick={() => go(item.view)}>
                <Icon size={20} aria-hidden="true" style={{ color: `var(--area-${item.view}, currentColor)` }} />
                <span className="all-tools-text">
                  <strong>{item.label}</strong>
                  <span className="small muted">{hint}</span>
                  {hiddenBecause === 'simples' && <span className="tiny all-tools-note">Fica fora do menu no modo Simples (Ajustes › Universo).</span>}
                  {hiddenBecause === 'menu' && <span className="tiny all-tools-note">Escondida do menu (Ajustes › Menu e ajuda). Tocar abre mesmo assim.</span>}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
