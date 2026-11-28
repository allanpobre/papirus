import { useTap } from '../ui/useTap'
import { bookScope } from '../logic/bookScope'
import { Check, Hexagon, ImagePlus, Layers, MapPin, Mountain, Minus, Plus, Route as RouteIcon, Trash2, TriangleAlert, X } from 'lucide-react'
import { daysText, fastTravels, MODE_LABEL, modeDays, ROUTE_LABEL, routeDays, travelDays, type Mode, type Route } from '../logic/travel'
import { ROUTE_KINDS } from '../model/schema'
import { tensionsOf } from '../logic/power'
import { centroid, inside, regionIn, type Region } from '../logic/regions'
import { coverLook } from '../ui/coverLook'
import { tabListKeys } from '../ui/keys'
import { useMemo, useRef, useState } from 'react'
import { useScrollPinch } from '../ui/useScrollPinch'
import { rangeText, routeOn } from '../logic/route'
import { kindLabel, kindPlural } from '../model/labels'
import type { AtlasMap } from '../model/schema'
import { byId, draftMap, entityName, insert, newId, patch, remove, chosenBook } from '../model/universe'
import { CropDialog } from '../images/CropDialog'
import type { Rect } from '../images/crop'
import { useWorkspace } from '../state/workspace'
import { Empty, YearInput } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { MoreMenu } from '../ui/MoreMenu'
import { EntityPicker } from '../ui/EntityPicker'
import { addImage } from '../images/add'
import { useImageSrc } from '../images/resolve'
import { AreaHead } from './AreaModes'
import { GeneratedCover } from '../ui/GeneratedCover'
import { drawContinent } from './continentCanvas'
import { membersOf } from '../model/lists'
import { useChosenYear } from './timeYear'
import { existsIn } from '../logic/timeMachine'
import { formatYear } from '../model/labels'

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
  const { universe, update, toast, nav } = useWorkspace()
  // Vindo de uma ficha, abre no mapa em que ela está.
  const [mapId, setMapId] = useState<string | null>((nav.view === 'atlas' && nav.id) || universe.maps[0]?.id || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const map = (mapId && byId(universe, 'maps', mapId)) || universe.maps[0]

  const [cropping, setCropping] = useState<File | null>(null)
  // Gerar um continente: costa, montanhas, rios e florestas. "Outro" no aviso troca a imagem por outra semente.
  const addContinent = () => {
    const img = drawContinent(Math.floor(Math.random() * 1e9))
    let id = ''
    update((u) => {
      const [next, m] = insert(u, 'maps', draftMap('Continente', img.data, img.width, img.height))
      id = m.id
      return next
    })
    setMapId(id)
    const again = () => {
      const next = drawContinent(Math.floor(Math.random() * 1e9))
      update((u) => patch(u, 'maps', id, { image: next.data }))
      toast('Outro continente.', { action: { label: 'Outro', run: again } })
    }
    toast('Continente gerado. Marque os lugares por cima.', { action: { label: 'Outro', run: again } })
  }
  const addMap = async (file?: File, crop?: Rect) => {
    try {
      // O mapa vai para as imagens do universo (fora do arquivo do universo, que fica leve).
      const img = file ? await addImage(file, 'mapa', crop).then((r) => ({ data: r.ref, width: r.width, height: r.height })) : blankParchment()
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
      <AreaHead current="atlas" tour="atlas" />
      <header className="view-head view-head-wide area-tools">
        <div className="tabs tabs-inline" role="tablist" onKeyDown={tabListKeys} aria-label="Mapas">
          {universe.maps.map((m) => (
            <button key={m.id} type="button" role="tab" className="tab" aria-selected={m.id === map?.id} tabIndex={m.id === map?.id ? 0 : -1} onClick={() => setMapId(m.id)}>
              {m.name || 'Mapa'}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost atlas-add" aria-label="Adicionar mapa" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} aria-hidden="true" /> <span className="atlas-add-text">Adicionar mapa</span>
        </button>
        <button type="button" className="btn btn-ghost atlas-add" aria-label="Gerar" onClick={addContinent} title="Gerar um continente (costa, montanhas, rios e florestas) para começar">
          <Mountain size={16} aria-hidden="true" /> <span className="atlas-add-text">Gerar</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            // Copia a lista antes de limpar o campo (limpar esvazia a lista). O mapa passa por um recorte livre.
            const f = Array.from(e.target.files ?? [])[0]
            e.target.value = ''
            if (f) setCropping(f)
          }}
        />
        {cropping && (
          <CropDialog
            file={cropping}
            square={false}
            title="Recortar o mapa"
            onCancel={() => setCropping(null)}
            onError={(m) => toast(m, { tone: 'erro' })}
            onDone={(crop) => {
              const f = cropping
              setCropping(null)
              void addMap(f, crop)
            }}
          />
        )}
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
            <button type="button" className="btn" onClick={addContinent}>
              <Mountain size={16} /> Gerar um continente
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

type Layer = 'fronteiras' | 'povos' | 'crencas' | 'rotas' | 'tensoes'
const LAYERS: { id: Layer; name: string }[] = [
  { id: 'fronteiras', name: 'Fronteiras' },
  { id: 'povos', name: 'Povos e línguas' },
  { id: 'crencas', name: 'Crenças' },
  { id: 'rotas', name: 'Rotas' },
  { id: 'tensoes', name: 'Tensões' },
]
/** A camada de uma região, pelo tipo da ficha dona dela. */
const layerOf = (kind: string | undefined): Layer => (kind === 'cultura' || kind === 'especie' ? 'povos' : kind === 'religiao' ? 'crencas' : 'fronteiras')

function MapCanvas({ map }: { map: AtlasMap }) {
  const { universe, update, peek, go, undoable, toast, bookId } = useWorkspace()
  // Nova cara: tocar num país ou marcador abre a gaveta com quem vive lá; editar fica num botão.
  const [editPlace, setEditPlace] = useState(false)
  const mapSrc = useImageSrc(map.image)
  // Com um livro escolhido no alto, os lugares dele ficam em destaque e os outros, apagados.
  const book = chosenBook(universe, bookId)
  // Lugares novos (que ainda não aparecem em livro nenhum) não ficam apagados: a mesma regra de Fichas e Linha do tempo.
  const scope = useMemo(() => bookScope(universe, bookId), [universe, bookId])
  const [zoom, setZoom] = useState(1)
  const [placing, setPlacing] = useState<string | null>(null)
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set())
  // No toque: um dedo move o mapa direto, dois dedos aproximam (e o zoom só é guardado ao soltar); o mouse segue com a rolagem.
  const { scrollRef, imgRef, wasDrag, bind } = useScrollPinch(zoom, setZoom, { minZoom: 1, maxZoom: 4 })
  // Arrastar (só com o mouse, e só depois de mexer uns pixels: um clique não move).
  const dragging = useRef<{ id: string; x: number; y: number; moved: boolean; before: AtlasMap['pins'] } | null>(null)
  // Mover pelo toque: escolhe "Mover" no cartão e toca no lugar novo.
  const [moving, setMoving] = useState<string | null>(null)
  // Mapa político: escolher de quem é a região e tocar os cantos no mapa.
  // No celular, as ferramentas menos usadas ficam atrás de "Mais" (a barra não ocupa três linhas).
  const [extra, setExtra] = useState(false)
  const [painting, setPainting] = useState<{ entityId: string | null; points: [number, number][] } | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const setRegions = (regions: Region[]) => update((u) => patch(u, 'maps', map.id, { regions }))
  // Rotas: tocar um marcador e depois outro liga os dois. Tocar o rótulo da rota abre o tipo e os dias.
  const [routing, setRouting] = useState<{ from: string | null } | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const routes = map.routes ?? []
  const setRoutes = (next: Route[]) => update((u) => patch(u, 'maps', map.id, { routes: next }))
  // Camadas: o que aparece por cima do mapa (fronteiras, povos, crenças e rotas).
  const [layersOff, setLayersOff] = useState<Set<Layer>>(new Set())

  const tap = useTap(wasDrag)
  /**
   * Os gestos de um marcador. No toque, o dedo que começa num marcador pode ser o começo de um arrasto do mapa: o toque
   * sobe até o mapa e o marcador só é escolhido num toque parado (ao levantar o dedo). Com o mouse, escolhe já e dá
   * para arrastar o marcador.
   */
  const pinTap = (id: string) => {
    const t = tap(() => choosePin(id))
    return {
      ...t,
      onPointerDown: (ev: React.PointerEvent) => {
        t.onPointerDown(ev)
        if (ev.pointerType !== 'mouse') return
        ev.stopPropagation()
        choosePin(id)
        ;(ev.currentTarget as Element).setPointerCapture?.(ev.pointerId)
        dragging.current = { id, x: ev.clientX, y: ev.clientY, moved: false, before: map.pins }
      },
      onPointerUp: (ev: React.PointerEvent) => {
        t.onPointerUp(ev)
        finishDrag()
      },
    }
  }
  const choosePin = (id: string) => {
    if (routing) {
      if (!routing.from) {
        setRouting({ from: id })
        return
      }
      if (routing.from === id) return
      const same = routes.find((r) => (r.from === routing.from && r.to === id) || (r.to === routing.from && r.from === id))
      if (same) {
        setSelectedRoute(same.id)
        setRouting(null)
        return
      }
      const r: Route = { id: newId(), from: routing.from, to: id, kind: 'estrada', days: null }
      setRoutes([...routes, r])
      setSelectedRoute(r.id)
      setRouting(null)
      return
    }
    setSelectedPin(id)
    if (moving !== id) setMoving(null)
  }
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
  // Máquina do tempo: com um ano escolhido (na Linha do tempo), o que ainda não existia (ou já acabou) some do mapa.
  const [year, setYear] = useChosenYear(universe.id)
  const exists = (id: string) => {
    const e = byId(universe, 'entities', id)
    return year === null || !e || existsIn(e, year)
  }
  const visible = map.pins.filter((p) => !hiddenKinds.has(byId(universe, 'entities', p.entityId)?.kind ?? '') && exists(p.entityId))
  const outOfTime = year === null ? 0 : map.pins.filter((p) => !exists(p.entityId)).length
  const regions = (map.regions ?? []).filter((r) => regionIn(universe, r, year) && !layersOff.has(layerOf(byId(universe, 'entities', r.entityId)?.kind)))
  const toneOf = (id: string) => coverLook(entityName(universe, id) || id).tone
  const region = selectedRegion ? (map.regions ?? []).find((r) => r.id === selectedRegion) : undefined
  // Outra região ou marcador: a gaveta volta a mostrar quem vive lá (não o modo de editar).
  const placeKey = `${selectedRegion ?? ''}|${selectedPin ?? ''}`
  const [lastPlace, setLastPlace] = useState(placeKey)
  if (lastPlace !== placeKey) {
    setLastPlace(placeKey)
    setEditPlace(false)
  }
  const finishRegion = () => {
    if (!painting?.entityId || painting.points.length < 3) return
    setRegions([...(map.regions ?? []), { id: newId(), entityId: painting.entityId, points: painting.points, fromYear: null, toYear: null }])
    setPainting(null)
    toast('Região pintada. Toque no nome dela para ajustar os anos ou apagar.')
  }
  // Caminho de um personagem pelas cenas.
  const [traveler, setTraveler] = useState('')
  const travelers = useMemo(
    () => universe.entities.filter((e) => e.kind === 'personagem' && routeOn(universe, map, e.id).length > 0).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [universe, map],
  )
  const route = useMemo(() => (traveler ? routeOn(universe, map, traveler) : []), [universe, map, traveler])
  const fast = useMemo(() => (traveler ? fastTravels(universe, map, traveler) : []), [universe, map, traveler])
  const pinName = (pinId: string) => {
    const p = map.pins.find((x) => x.id === pinId)
    return p ? p.label || entityName(universe, p.entityId) || '?' : '?'
  }
  const openRoute = selectedRoute ? routes.find((r) => r.id === selectedRoute) : undefined
  const shownRoutes = layersOff.has('rotas') ? [] : routes
  // Tensões entre quem tem marcador ou região no mapa: uma linha amarela (tenso) ou vermelha (guerra).
  const spotOf = (id: string): [number, number] | null => {
    const p = map.pins.find((x) => x.entityId === id)
    if (p) return [p.x, p.y]
    const r = (map.regions ?? []).find((x) => x.entityId === id)
    return r ? centroid(r.points) : null
  }
  const mapTensions = tensionsOf(universe)
    .filter((t) => t.level !== 'paz')
    .map((t) => ({ t, a: spotOf(t.a.id), b: spotOf(t.b.id) }))
    .filter((x): x is { t: (typeof x)['t']; a: [number, number]; b: [number, number] } => !!x.a && !!x.b)
  const shownTensions = layersOff.has('tensoes') ? [] : mapTensions
  const pin = selectedPin ? map.pins.find((p) => p.id === selectedPin) : undefined
  const pinEntity = pin ? byId(universe, 'entities', pin.entityId) : undefined

  return (
    <div className="atlas">
      <div className={`atlas-toolbar${extra ? ' show-extra' : ''}`}>
        <label htmlFor="map-name" className="sr-only">
          Nome do mapa
        </label>
        <input id="map-name" className="input input-sm atlas-extra atlas-name" value={map.name} onChange={(e) => update((u) => patch(u, 'maps', map.id, { name: e.target.value }))} />
        <button type="button" className={`btn btn-sm ${placing !== null ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={placing !== null} onClick={() => { setPlacing(placing === null ? '' : null); setPending(null) }}>
          <MapPin size={15} /> {placing !== null ? 'Toque no mapa…' : 'Marcar lugar'}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${routing ? 'btn-primary' : 'btn-ghost'}`}
          aria-pressed={routing !== null}
          disabled={map.pins.length < 2}
          title={map.pins.length < 2 ? 'Marque dois lugares para ligar' : 'Ligar dois lugares com uma rota'}
          onClick={() => {
            setRouting(routing ? null : { from: null })
            setPlacing(null)
            setPending(null)
            setPainting(null)
            setSelectedPin(null)
          }}
        >
          <RouteIcon size={15} /> {routing ? 'Ligando…' : 'Rota'}
        </button>
        <button
          type="button"
          className={`btn btn-sm atlas-extra ${painting ? 'btn-primary' : 'btn-ghost'}`}
          aria-pressed={painting !== null}
          onClick={() => {
            setPainting(painting ? null : { entityId: null, points: [] })
            setPlacing(null)
            setPending(null)
          }}
        >
          <Hexagon size={15} /> {painting ? 'Pintando região…' : 'Pintar região'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm atlas-more" aria-expanded={extra} onClick={() => setExtra((v) => !v)}>
          {extra ? 'Menos' : 'Mais'}
        </button>
        <span className="atlas-zoom atlas-extra">
          <button type="button" className="btn-icon btn-sm" aria-label="Afastar" onClick={() => setZoom((z) => Math.max(1, z / 1.25))}>
            <Minus size={15} />
          </button>
          <span className="tabular small">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-icon btn-sm" aria-label="Aproximar" onClick={() => setZoom((z) => Math.min(4, z * 1.25))}>
            <Plus size={15} />
          </button>
        </span>
        {/* Tipos de lugar e camadas (fronteiras, povos, rotas…) num menu só: antes eram duas fileiras de botões pretos. */}
        {(kinds.length > 1 || (map.regions ?? []).length > 0 || routes.length > 0 || mapTensions.length > 0) && (
          <span className="atlas-extra atlas-layers">
            <MoreMenu label="Camadas do mapa" buttonClass="btn btn-ghost btn-sm" popClass="atlas-layers-pop" button={<><Layers size={15} aria-hidden="true" /> Camadas</>}>
              {() => (
                <>
                  <span className="more-menu-label">Mostrar no mapa</span>
                  {kinds.length > 1 && (
                    <span className="filter-chips">
                      {kinds.map((k) => (
                        <button key={k} type="button" className="chip" aria-pressed={!hiddenKinds.has(k)} onClick={() => setHiddenKinds((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n })}>
                          {kindPlural(k)}
                        </button>
                      ))}
                    </span>
                  )}
        {((map.regions ?? []).length > 0 || routes.length > 0 || mapTensions.length > 0) && (
                    <span className="filter-chips" role="group" aria-label="Camadas">
                      {LAYERS.filter((l) => (l.id === 'tensoes' ? mapTensions.length > 0 : l.id === 'rotas' ? routes.length > 0 : (map.regions ?? []).some((r) => layerOf(byId(universe, 'entities', r.entityId)?.kind) === l.id))).map((l) => (
                        <button key={l.id} type="button" className="chip" aria-pressed={!layersOff.has(l.id)} onClick={() => setLayersOff((h) => { const n = new Set(h); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n })}>
                          {l.name}
                        </button>
                      ))}
                    </span>
                  )}
                </>
              )}
            </MoreMenu>
          </span>
        )}
        {book && scope && (
          <span className="atlas-year small">
            Em destaque: os lugares de “{book.title || 'Sem título'}” ({visible.filter((p) => scope.belongs(p.entityId)).length})
          </span>
        )}
        {year !== null && (
          <span className="atlas-year small" role="status">
            No ano {formatYear(year, universe.settings.calendarSuffix)}
            {outOfTime > 0 && ` · ${outOfTime} ${outOfTime === 1 ? 'marcador apagado' : 'marcadores apagados'}`}
            <button
              type="button"
              className="link-btn"
              onClick={() => setYear(null)}
            >
              Ver todos os tempos
            </button>
          </span>
        )}
        {travelers.length > 0 && (
          <label className="atlas-route-pick atlas-extra">
            <span className="small">Ver o caminho de</span>
            <select className="input input-sm" value={traveler} onChange={(e) => setTraveler(e.target.value)}>
              <option value="">Ninguém</option>
              {travelers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="atlas-extra">
          <MoreMenu label="Mais ações do mapa">
            {(close) => (
              <ConfirmButton
                className="more-menu-item more-menu-danger"
                question="Apagar este mapa e seus marcadores?"
                confirmLabel="Apagar mapa"
                onConfirm={() => {
                  close()
                  undoable('Mapa apagado', (u) => remove(u, 'maps', map.id))
                }}
              >
                <Trash2 size={15} /> Apagar mapa
              </ConfirmButton>
            )}
          </MoreMenu>
        </span>
      </div>

      {route.length > 0 && (
        <ol className="atlas-route-list small" aria-label="Caminho, na ordem das cenas">
          {route.map((r, i) => {
            const leg = i > 0 ? travelDays(map, route[i - 1].pinId, r.pinId) : null
            return (
              <li key={i}>
                {leg !== null && leg > 0 && <span className="atlas-leg muted">({daysText(leg)} de viagem) </span>}
                <strong>{r.place}</strong> <span className="muted">(cena{r.scenes.length > 1 ? 's' : ''} {rangeText(r.scenes)})</span>
              </li>
            )
          })}
        </ol>
      )}
      {fast.length > 0 && (
        <ul className="atlas-fast small" aria-label="Viagens rápidas demais">
          {fast.map((f, i) => (
            <li key={i}>
              <TriangleAlert size={14} aria-hidden="true" /> De {f.from} a {f.to} (cenas {f.scenes[0]} e {f.scenes[1]}): {f.elapsed === 0 ? 'é o mesmo dia' : `passa ${daysText(f.elapsed)}`}, mas a viagem leva {daysText(f.needed)} no jeito mais rápido.
            </li>
          ))}
        </ul>
      )}
      {routing && (
        <div className="atlas-paint" role="group" aria-label="Ligar lugares">
          <span className="small">{routing.from ? <>De <strong>{pinName(routing.from)}</strong>: agora toque no outro lugar.</> : 'Toque no primeiro lugar da rota.'}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRouting(null)}>
            Cancelar
          </button>
        </div>
      )}
      {openRoute && (
        <div className="atlas-paint atlas-route-edit" role="group" aria-label={`Rota de ${pinName(openRoute.from)} a ${pinName(openRoute.to)}`}>
          <strong className="small">
            {pinName(openRoute.from)} ↔ {pinName(openRoute.to)}
          </strong>
          <div className="chips" role="radiogroup" aria-label="Tipo de rota">
            {ROUTE_KINDS.map((k) => (
              <button key={k} type="button" role="radio" className="chip" aria-checked={openRoute.kind === k} onClick={() => setRoutes(routes.map((r) => (r.id === openRoute.id ? { ...r, kind: k } : r)))}>
                {ROUTE_LABEL[k]}
              </button>
            ))}
          </div>
          <label className="small atlas-days">
            {openRoute.kind === 'mar' ? 'Dias de barco' : 'Dias a pé'}
            <input
              className="input input-sm"
              type="number"
              min={0}
              step={0.5}
              placeholder={routeDays({ ...map }, { ...openRoute, days: null }) !== null ? String(routeDays(map, { ...openRoute, days: null })) : '?'}
              value={openRoute.days ?? ''}
              onChange={(ev) => setRoutes(routes.map((r) => (r.id === openRoute.id ? { ...r, days: ev.target.value === '' ? null : Math.max(0, Number(ev.target.value)) } : r)))}
            />
          </label>
          <span className="small muted" aria-label="Tempo de viagem">
            {(['pe', 'cavalo', 'barco'] as Mode[])
              .map((m) => [m, modeDays(map, openRoute, m)] as const)
              .filter(([, d]) => d !== null)
              .map(([m, d]) => `${daysText(d!)} ${MODE_LABEL[m]}`)
              .join(' · ') || 'Escreva os dias, ou dê a escala do mapa.'}
          </span>
          {!map.widthDays && (
            <label className="small atlas-days">
              Escala: dias a pé de ponta a ponta do mapa
              <input className="input input-sm" type="number" min={1} placeholder="30" onChange={(ev) => Number(ev.target.value) > 0 && update((u) => patch(u, 'maps', map.id, { widthDays: Number(ev.target.value) }))} />
            </label>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setRoutes(routes.filter((r) => r.id !== openRoute.id))
              setSelectedRoute(null)
            }}
          >
            <Trash2 size={15} /> Apagar rota
          </button>
          <button type="button" className="btn btn-sm btn-ghost" aria-label="Fechar" onClick={() => setSelectedRoute(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {painting && (
        <div className="atlas-paint" role="group" aria-label="Pintar região">
          {!painting.entityId ? (
            <EntityPicker label="De quem é esta região?" kinds={['reino', 'faccao', 'lugar', 'cultura', 'especie', 'religiao']} value={null} onChange={(id) => id && setPainting({ entityId: id, points: [] })} />
          ) : (
            <>
              <span className="small">
                <strong>{entityName(universe, painting.entityId)}</strong>: toque os cantos da região no mapa ({painting.points.length} {painting.points.length === 1 ? 'ponto' : 'pontos'}).
              </span>
              <button type="button" className="btn btn-sm btn-primary" disabled={painting.points.length < 3} onClick={finishRegion}>
                <Check size={15} /> Concluir
              </button>
              {painting.points.length > 0 && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPainting({ ...painting, points: painting.points.slice(0, -1) })}>
                  Desfazer ponto
                </button>
              )}
            </>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPainting(null)}>
            Cancelar
          </button>
        </div>
      )}
      {region && !editPlace && (
        <PlaceDrawer
          entityId={region.entityId}
          also={map.pins.filter((p) => inside([p.x, p.y], region.points)).map((p) => p.entityId)}
          onClose={() => setSelectedRegion(null)}
          onEdit={() => setEditPlace(true)}
        />
      )}
      {region && editPlace && (
        <div className="atlas-paint" role="group" aria-label={`Região de ${entityName(universe, region.entityId)}`}>
          <strong className="small">{entityName(universe, region.entityId) || 'Região'}</strong>
          <YearInput label="De (ano)" value={region.fromYear} onChange={(n) => setRegions((map.regions ?? []).map((r) => (r.id === region.id ? { ...r, fromYear: n } : r)))} />
          <YearInput label="Até (ano)" value={region.toYear} onChange={(n) => setRegions((map.regions ?? []).map((r) => (r.id === region.id ? { ...r, toYear: n } : r)))} />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('fichas', region.entityId)}>
            Abrir ficha
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setRegions((map.regions ?? []).filter((r) => r.id !== region.id))
              setSelectedRegion(null)
            }}
          >
            <Trash2 size={15} /> Apagar região
          </button>
        </div>
      )}
      <div className="atlas-scroll" ref={scrollRef} {...bind} style={{ aspectRatio: `${map.width} / ${map.height}` }}>
        <div
          ref={imgRef}
          className={`atlas-image${zoom < 1.6 ? ' is-far' : ''}${placing !== null || moving || painting?.entityId ? ' placing' : ''}${painting?.entityId ? ' painting' : ''}${routing ? ' routing' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${map.width} / ${map.height}`, backgroundImage: mapSrc ? `url("${mapSrc}")` : undefined }}
          onClick={(e) => {
            // O que acabou de ser arrasto ou pinça no toque não vale como toque no mapa.
            if (wasDrag()) return
            // Pintando uma região, todo toque vira um canto (mesmo em cima de um marcador).
            if (painting) {
              if (!painting.entityId) return
              const c = coords(e)
              setPainting({ ...painting, points: [...painting.points, [c.x, c.y]] })
              return
            }
            if ((e.target as Element).closest('.pin')) return
            if ((e.target as Element).closest('.atlas-region-label')) return
            if ((e.target as Element).closest('.atlas-road-label')) return
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
          {(regions.length > 0 || (painting && painting.points.length > 0)) && (
            <svg className="atlas-regions" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              {regions.map((r) => (
                <polygon
                  key={r.id}
                  points={r.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')}
                  style={{ '--region': toneOf(r.entityId) } as React.CSSProperties}
                  className={r.id === selectedRegion ? 'selected' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {painting && painting.points.length > 0 && (
                <polyline className="atlas-region-draft" points={painting.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')} vectorEffect="non-scaling-stroke" />
              )}
            </svg>
          )}
          {regions.map((r) => {
            const [cx, cy] = centroid(r.points)
            return (
              <button key={`l${r.id}`} type="button" className="atlas-region-label" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }} onClick={() => setSelectedRegion(r.id === selectedRegion ? null : r.id)}>
                {entityName(universe, r.entityId) || 'Região'}
              </button>
            )
          })}
          {shownTensions.length > 0 && (
            <svg className="atlas-roads" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={`Tensões: ${shownTensions.map((x) => `${x.t.a.name} e ${x.t.b.name}`).join(', ')}`}>
              {shownTensions.map(({ t, a, b }) => (
                <line key={t.relation.id} className={`tension tension-${t.level}`} x1={a[0] * 1000} y1={a[1] * 1000} x2={b[0] * 1000} y2={b[1] * 1000} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          )}
          {shownRoutes.length > 0 && (
            <svg className="atlas-roads" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              {shownRoutes.map((r) => {
                const a = map.pins.find((p) => p.id === r.from)
                const b = map.pins.find((p) => p.id === r.to)
                if (!a || !b) return null
                return <line key={r.id} className={`road road-${r.kind}${r.id === selectedRoute ? ' selected' : ''}`} x1={a.x * 1000} y1={a.y * 1000} x2={b.x * 1000} y2={b.y * 1000} vectorEffect="non-scaling-stroke" />
              })}
            </svg>
          )}
          {shownRoutes.map((r) => {
            const a = map.pins.find((p) => p.id === r.from)
            const b = map.pins.find((p) => p.id === r.to)
            if (!a || !b) return null
            const d = routeDays(map, r)
            return (
              <button
                key={`d${r.id}`}
                type="button"
                className={`atlas-road-label road-${r.kind}`}
                style={{ left: `${((a.x + b.x) / 2) * 100}%`, top: `${((a.y + b.y) / 2) * 100}%` }}
                aria-label={`${ROUTE_LABEL[r.kind]} de ${pinName(r.from)} a ${pinName(r.to)}${d !== null ? `: ${daysText(d)}` : ''}`}
                onClick={(ev) => {
                  ev.stopPropagation()
                  setSelectedRoute(r.id === selectedRoute ? null : r.id)
                  setSelectedPin(null)
                }}
              >
                {d !== null ? `${String(d).replace('.', ',')} d` : '?'}
              </button>
            )
          })}
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
          {visible.map((p, pi) => {
            const e = byId(universe, 'entities', p.entityId)
            return (
              <button
                key={p.id}
                type="button"
                className={`pin kind-${e?.kind ?? 'lugar'}${p.id === selectedPin ? ' selected' : ''}${scope && !scope.belongs(p.entityId) && !scope.inNoBook(p.entityId) ? ' off-book' : ''}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, '--i': Math.min(pi, 14) } as React.CSSProperties}
                aria-label={`${p.label || e?.name || 'Marcador'}${e ? `, ${kindLabel(e.kind)}` : ''}`}
                {...pinTap(p.id)}
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

      {/* Celular: com o mapa inteiro à vista, os nomes saem de cima dele e ficam nesta lista (toque para abrir). Só para quem vê: os marcadores têm nome para o leitor de tela. */}
      {visible.length > 0 && (
        <ul className="atlas-places" aria-hidden="true">
          {visible.map((p) => (
            <li key={p.id}>
              <button type="button" tabIndex={-1} className={`chip${p.id === selectedPin ? ' is-on' : ''}`} onClick={() => choosePin(p.id)}>
                <MapPin size={13} aria-hidden="true" /> {p.label || entityName(universe, p.entityId) || '?'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pin && moving === pin.id && (
        <div className="atlas-moving" role="status">
          <span className="small">Toque no mapa onde “{pin.label || pinEntity?.name || 'o marcador'}” deve ficar.</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMoving(null)}>
            Cancelar
          </button>
        </div>
      )}
      {pin && moving !== pin.id && !editPlace && pinEntity && (
        <PlaceDrawer
          entityId={pinEntity.id}
          onClose={() => setSelectedPin(null)}
          onEdit={() => setEditPlace(true)}
        />
      )}
      {pin && moving !== pin.id && (editPlace || !pinEntity) && (
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

/**
 * A gaveta de um lugar (Nova cara): o nome, o resumo e quem vive lá (os de dentro e os das listas dele), como
 * cartas com rosto. "Abrir ficha" e "Editar região" ficam à mão.
 */
function PlaceDrawer({ entityId, also = [], onClose, onEdit }: { entityId: string; also?: string[]; onClose: () => void; onEdit: () => void }) {
  const { universe, go } = useWorkspace()
  const place = byId(universe, 'entities', entityId)
  if (!place) return null
  const inside = universe.entities.filter((e) => e.parentId === place.id)
  const members = (place.lists ?? []).flatMap((l) => membersOf(universe, place.id, l.id).map((m) => m.member))
  // Também os marcadores que ficam dentro da região, no mapa.
  const pinned = also.flatMap((id) => (id === place.id ? [] : universe.entities.filter((e) => e.id === id)))
  const people = [...new Map([...members, ...inside, ...pinned].map((e) => [e.id, e])).values()]
  return (
    <aside className="place-drawer" aria-label={`Lugar: ${place.name || 'Sem nome'}`}>
      <span className="place-grip" aria-hidden="true" />
      <div className="place-head">
        <div>
          <h2>{place.name || 'Sem nome'}</h2>
          <p className="tiny muted">
            {kindLabel(place.kind)} · {people.length} {people.length === 1 ? 'ficha' : 'fichas'}
          </p>
        </div>
        <button type="button" className="btn-icon" aria-label="Fechar a gaveta" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {place.summary && <p className="small place-sum">{place.summary}</p>}
      {people.length > 0 && (
        <div className="place-cards">
          {people.map((e) => (
            <button key={e.id} type="button" className="place-card" onClick={() => go('fichas', e.id)}>
              <span className="place-face" aria-hidden="true">
                <GeneratedCover name={e.name || '?'} />
              </span>
              <b>{e.name || 'Sem nome'}</b>
              <small>{kindLabel(e.kind)}</small>
            </button>
          ))}
        </div>
      )}
      <div className="place-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => go('fichas', place.id)}>
          Abrir ficha
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onEdit}>
          Editar no mapa
        </button>
      </div>
    </aside>
  )
}
