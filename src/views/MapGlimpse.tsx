import { useImageSrc } from '../images/resolve'
import { glimpseOf } from '../logic/route'
import type { Entity } from '../model/schema'
import { entityName } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/** O pedaço do mapa de uma ficha, dentro dela: o marcador ou o caminho. Leva ao Atlas. */
export function MapGlimpse({ entity: e }: { entity: Entity }) {
  const { universe, go } = useWorkspace()
  const g = glimpseOf(universe, e.id)
  const src = useImageSrc(g?.map.image)
  if (!g) return null
  const { map, pin, inside, route } = g
  const caption =
    route.length > 1
      ? `O caminho de ${e.name || 'Sem nome'} pelas cenas: ${route.map((r) => r.place).join(', ')}`
      : inside
        ? `Fica em ${entityName(universe, inside)}`
        : route.length === 1
          ? `Nas cenas, em ${route[0].place}`
          : `Em “${map.name || 'Mapa'}”`
  return (
    <div className="map-glimpse">
      <p className="reader-infobox-label">No mapa</p>
      <button
        type="button"
        className="map-glimpse-img"
        style={{ aspectRatio: `${map.width} / ${map.height}`, backgroundImage: src ? `url("${src}")` : undefined }}
        aria-label={`Abrir “${map.name || 'Mapa'}” no Atlas`}
        onClick={() => go('atlas', map.id)}
      >
        {route.length > 1 && (
          <svg className="atlas-route" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={route.map((r) => `${r.x * 1000},${r.y * 1000}`).join(' ')} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {route.map((r, i) => (
          <span key={i} className="map-glimpse-stop" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }} aria-hidden="true" />
        ))}
        {pin && <span className="map-glimpse-pin" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-hidden="true" />}
      </button>
      <span className="muted small">{caption}</span>
    </div>
  )
}
