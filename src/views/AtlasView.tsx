import { ImagePlus, MapPin, Minus, Plus, Trash2, X } from 'lucide-react'
import { tabListKeys } from '../ui/keys'
import { useMemo, useRef, useState } from 'react'
import { rangeText, routeOn } from '../logic/route'
import { kindLabel, kindPlural } from '../model/labels'
import type { AtlasMap } from '../model/schema'
import { byId, draftMap, entityName, insert, newId, patch, remove } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Empty } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { EntityPicker } from '../ui/EntityPicker'

const MAX_SIDE = 2400

/** Reduz a imagem para caber no armazenamento local (JPEG, lado máximo 2400px). */
async function loadImage(file: File): Promise<{ data: string; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
      i.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const width = Math.round(img.width * scale)
    const height = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    return { data: canvas.toDataURL('image/jpeg', 0.85), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Um pergaminho em branco, para posicionar lugares sem ter um mapa desenhado. */
function blankParchment(): { data: string; width: number; height: number } {
  const width = 1600
  const height = 1000
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')!
  g.fillStyle = '#e9e4d6'
  g.fillRect(0, 0, width, height)
  g.strokeStyle = 'rgba(80, 70, 50, 0.12)'
  g.lineWidth = 1
  for (let x = 0; x <= width; x += 100) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, height)
    g.stroke()
  }
  for (let y = 0; y <= height; y += 100) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(width, y)
    g.stroke()
  }
  return { data: c.toDataURL('image/jpeg', 0.8), width, height }
}

export default function AtlasView() {
  const { universe, update, toast } = useWorkspace()
  const [mapId, setMapId] = useState<string | null>(universe.maps[0]?.id ?? null)
  const fileRef = useRef<HTMLInputElement>(null)
  const map = (mapId && byId(universe, 'maps', mapId)) || universe.maps[0]

  const addMap = async (file?: File) => {
    try {
      const img = file ? await loadImage(file) : blankParchment()
      let id = ''
      update((u) => {
        const [next, m] = insert(u, 'maps', draftMap(file ? file.name.replace(/\.[^.]+$/, '') : 'Mapa em branco', img.data, img.width, img.height))
        id = m.id
        return next
      })
      setMapId(id)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível usar a imagem.', { tone: 'erro' })
    }
  }

  return (
    <div className="view atlas-view">
      <header className="view-head view-head-wide">
        <h1>Atlas</h1>
        <div className="tabs tabs-inline" role="tablist" onKeyDown={tabListKeys} aria-label="Mapas">
          {universe.maps.map((m) => (
            <button key={m.id} type="button" role="tab" className="tab" aria-selected={m.id === map?.id} tabIndex={m.id === map?.id ? 0 : -1} onClick={() => setMapId(m.id)}>
              {m.name || 'Mapa'}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} /> Adicionar mapa
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void addMap(f)
            e.target.value = ''
          }}
        />
      </header>

      {map ? (
        <MapCanvas key={map.id} map={map} />
      ) : (
        <Empty icon={<MapPin size={32} />} title="Nenhum mapa ainda.">
          <p>Envie a imagem do seu mapa (desenhado à mão, Inkarnate, qualquer coisa) e marque os lugares por cima.</p>
          <div className="inline-fields">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} /> Enviar imagem
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void addMap()}>
              Começar com um pergaminho em branco
            </button>
          </div>
        </Empty>
      )}
    </div>
  )
}

function MapCanvas({ map }: { map: AtlasMap }) {
  const { universe, update, peek, go, undoable } = useWorkspace()
  const [zoom, setZoom] = useState(1)
  const [placing, setPlacing] = useState<string | null>(null)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  const imgRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)

  const setPins = (pins: AtlasMap['pins']) => update((u) => patch(u, 'maps', map.id, { pins }))
  const coords = (e: React.PointerEvent | React.MouseEvent) => {
    const r = imgRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  const kinds = [...new Set(map.pins.map((p) => byId(universe, 'entities', p.entityId)?.kind).filter(Boolean) as string[])]
  const visible = map.pins.filter((p) => !hiddenKinds.has(byId(universe, 'entities', p.entityId)?.kind ?? ''))
  // Caminho de um personagem pelas cenas.
  const [traveler, setTraveler] = useState('')
  const travelers = useMemo(
    () => universe.entities.filter((e) => e.kind === 'personagem' && routeOn(universe, map, e.id).length > 0).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [universe, map],
  )
  const route = useMemo(() => (traveler ? routeOn(universe, map, traveler) : []), [universe, map, traveler])
  const pin = selectedPin ? map.pins.find((p) => p.id === selectedPin) : undefined
  const pinEntity = pin ? byId(universe, 'entities', pin.entityId) : undefined

  return (
    <div className="atlas">
      <div className="atlas-toolbar">
        <label htmlFor="map-name" className="sr-only">
          Nome do mapa
        </label>
        <input id="map-name" className="input input-sm" value={map.name} onChange={(e) => update((u) => patch(u, 'maps', map.id, { name: e.target.value }))} />
        <button type="button" className={`btn btn-sm ${placing !== null ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={placing !== null} onClick={() => { setPlacing(placing === null ? '' : null); setPending(null) }}>
          <MapPin size={15} /> {placing !== null ? 'Clique no mapa…' : 'Marcar lugar'}
        </button>
        <span className="atlas-zoom">
          <button type="button" className="btn-icon btn-sm" aria-label="Afastar" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}>
            <Minus size={15} />
          </button>
          <span className="tabular small">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-icon btn-sm" aria-label="Aproximar" onClick={() => setZoom((z) => Math.min(4, z * 1.25))}>
            <Plus size={15} />
          </button>
        </span>
        {kinds.length > 1 && (
          <span className="filter-chips">
            {kinds.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={!hiddenKinds.has(k)} onClick={() => setHiddenKinds((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n })}>
                {kindPlural(k)}
              </button>
            ))}
          </span>
        )}
        {travelers.length > 0 && (
          <label className="atlas-route-pick">
            <span className="small">Caminho de</span>
            <select className="input input-sm" value={traveler} onChange={(e) => setTraveler(e.target.value)}>
              <option value="">ninguém</option>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ConfirmButton
          className="btn btn-ghost btn-sm"
          question="Apagar este mapa e seus marcadores?"
          confirmLabel="Apagar mapa"
          onConfirm={() => undoable('Mapa apagado', (u) => remove(u, 'maps', map.id))}
        >
          <Trash2 size={15} /> Apagar mapa
        </ConfirmButton>
      </div>

      {route.length > 0 && (
        <ol className="atlas-route-list small" aria-label="Caminho, na ordem das cenas">
          {route.map((r, i) => (
            <li key={i}>
              <strong>{r.place}</strong> <span className="muted">(cena{r.scenes.length > 1 ? 's' : ''} {rangeText(r.scenes)})</span>
            </li>
          ))}
        </ol>
      )}
      <div className="atlas-scroll">
        <div
          ref={imgRef}
          className={`atlas-image${placing !== null ? ' placing' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${map.width} / ${map.height}`, backgroundImage: `url("${map.image}")` }}
          onClick={(e) => {
            if (placing === null || (e.target as Element).closest('.pin')) return
            setPending(coords(e))
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            const c = coords(e)
            setPins(map.pins.map((p) => (p.id === dragging.current ? { ...p, ...c } : p)))
          }}
          onPointerUp={() => (dragging.current = null)}
        >
          {route.length > 1 && (
            <svg className="atlas-route" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={route.map((r) => `${r.x * 1000},${r.y * 1000}`).join(' ')} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {route.map((r, i) => (
            <span key={`r${i}`} className="atlas-route-stop" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }} aria-hidden="true">
              {i + 1}
            </span>
          ))}
          {visible.map((p) => {
            const e = byId(universe, 'entities', p.entityId)
            return (
              <button
                key={p.id}
                type="button"
                className={`pin kind-${e?.kind ?? 'lugar'}${p.id === selectedPin ? ' selected' : ''}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                aria-label={`${p.label || e?.name || 'Marcador'}${e ? `, ${kindLabel(e.kind)}` : ''}`}
                onPointerDown={(ev) => {
                  ev.stopPropagation()
                  ;(ev.currentTarget as Element).setPointerCapture?.(ev.pointerId)
                  dragging.current = p.id
                  setSelectedPin(p.id)
                }}
                onPointerUp={() => (dragging.current = null)}
              >
                <MapPin size={22} aria-hidden="true" />
                <span className="pin-label">{p.label || e?.name || '?'}</span>
              </button>
            )
          })}
          {pending && (
            <div className="pin-pending" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} onClick={(e) => e.stopPropagation()}>
              <EntityPicker
                label="Qual lugar é este?"
                kinds={['lugar', 'reino']}
                value={null}
                placeholder="Lugar…"
                onChange={(id) => {
                  if (id) setPins([...map.pins, { id: newId(), entityId: id, x: pending.x, y: pending.y, label: '' }])
                  setPending(null)
                  setPlacing(null)
                }}
              />
              <button type="button" className="btn-icon btn-sm" aria-label="Cancelar" onClick={() => setPending(null)}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {pin && (
        <aside className="atlas-panel" aria-label="Marcador">
          <button type="button" className="btn-icon graph-panel-close" aria-label="Fechar o cartão" onClick={() => setSelectedPin(null)}>
            <X size={16} />
          </button>
          <span className="eyebrow">{pinEntity ? kindLabel(pinEntity.kind) : 'Marcador'}</span>
          <h2>{pinEntity?.name ?? 'Ficha removida'}</h2>
          {pinEntity?.summary && <p className="small">{pinEntity.summary}</p>}
          {pinEntity?.parentId && <p className="muted small">Em {entityName(universe, pinEntity.parentId)}</p>}
          <label className="field-label" htmlFor="pin-label">
            Rótulo no mapa
          </label>
          <input id="pin-label" className="input input-sm" placeholder={pinEntity?.name} value={pin.label} onChange={(e) => setPins(map.pins.map((p) => (p.id === pin.id ? { ...p, label: e.target.value } : p)))} />
          <div className="inline-fields">
            {pinEntity && (
              <>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => go('fichas', pinEntity.id)}>
                  Abrir ficha
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => peek(pinEntity.id)}>
                  Espiar
                </button>
              </>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setPins(map.pins.filter((p) => p.id !== pin.id)); setSelectedPin(null) }}>
              Remover marcador
            </button>
          </div>
          <p className="muted tiny">Arraste o marcador para movê-lo.</p>
        </aside>
      )}
    </div>
  )
}
