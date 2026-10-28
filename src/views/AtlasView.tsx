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
import { addImage } from '../images/add'
import { useImageSrc } from '../images/resolve'
import { PageHelp } from '../ui/PageTour'

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
      // O mapa vai para as imagens do universo (fora do arquivo do universo, que fica leve).
      const img = file ? await addImage(file, 'mapa').then((r) => ({ data: r.ref, width: r.width, height: r.height })) : blankParchment()
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
        <PageHelp tour="atlas" />
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
  const { universe, update, peek, go, undoable, toast } = useWorkspace()
  const mapSrc = useImageSrc(map.image)
  const [zoom, setZoom] = useState(1)
  const [placing, setPlacing] = useState<string | null>(null)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  const imgRef = useRef<HTMLDivElement>(null)
  // Arrastar (só com o mouse, e só depois de mexer uns pixels: um clique não move).
  const dragging = useRef<{ id: string; x: number; y: number; moved: boolean; before: AtlasMap['pins'] } | null>(null)
  // Mover pelo toque: escolhe "Mover" no cartão e toca no lugar novo.
  const [moving, setMoving] = useState<string | null>(null)

  const setPins = (pins: AtlasMap['pins']) => update((u) => patch(u, 'maps', map.id, { pins }))
  // Depois de mover, dá para voltar: o aviso traz "Desfazer".
  const movedToast = (before: AtlasMap['pins']) => toast('Marcador movido', { action: { label: 'Desfazer', run: () => setPins(before) } })
  const finishDrag = () => {
    const d = dragging.current
    dragging.current = null
    if (d?.moved) movedToast(d.before)
  }
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
          className={`atlas-image${placing !== null || moving ? ' placing' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${map.width} / ${map.height}`, backgroundImage: mapSrc ? `url("${mapSrc}")` : undefined }}
          onClick={(e) => {
            if ((e.target as Element).closest('.pin')) return
            if (moving) {
              const before = map.pins
              const c = coords(e)
              setPins(map.pins.map((p) => (p.id === moving ? { ...p, ...c } : p)))
              setMoving(null)
              // Fecha o cartão para ver o marcador no lugar novo.
              setSelectedPin(null)
              movedToast(before)
              return
            }
            if (placing === null) return
            setPending(coords(e))
          }}
          onPointerMove={(e) => {
            const d = dragging.current
            if (!d) return
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return
            d.moved = true
            const c = coords(e)
            setPins(map.pins.map((p) => (p.id === d.id ? { ...p, ...c } : p)))
          }}
          onPointerUp={finishDrag}
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
                  setSelectedPin(p.id)
                  if (moving !== p.id) setMoving(null)
                  // No toque, só seleciona (arrastar sem querer era fácil demais).
                  if (ev.pointerType !== 'mouse') return
                  ;(ev.currentTarget as Element).setPointerCapture?.(ev.pointerId)
                  dragging.current = { id: p.id, x: ev.clientX, y: ev.clientY, moved: false, before: map.pins }
                }}
                onPointerUp={finishDrag}
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

      {pin && moving === pin.id && (
        <div className="atlas-moving" role="status">
          <span className="small">Toque no mapa onde “{pin.label || pinEntity?.name || 'o marcador'}” deve ficar.</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMoving(null)}>
            Cancelar
          </button>
        </div>
      )}
      {pin && moving !== pin.id && (
        <aside className="atlas-panel" aria-label="Marcador">
          <button
            type="button"
            className="btn-icon graph-panel-close"
            aria-label="Fechar o cartão"
            onClick={() => {
              setSelectedPin(null)
              setMoving(null)
            }}
          >
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
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMoving(pin.id)}>
              Mover
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                undoable('Marcador removido', (u) => patch(u, 'maps', map.id, { pins: map.pins.filter((p) => p.id !== pin.id) }))
                setSelectedPin(null)
              }}
            >
              Remover marcador
            </button>
          </div>
          <p className="muted tiny">Para mudar de lugar: “Mover” e toque no mapa (com o mouse, dá para arrastar).</p>
        </aside>
      )}
    </div>
  )
}
