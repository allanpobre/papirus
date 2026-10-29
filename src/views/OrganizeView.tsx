import { GripVertical, PanelsTopLeft } from 'lucide-react'
import { tabListKeys } from '../ui/keys'
import { useMemo, useState } from 'react'
import { mapNotices, promiseLines, STRUCTURE_LABEL, STRUCTURES, storyMap, withoutCard, type MapNotice, type MapScene, type PromiseLine, type Structure } from '../logic/map'
import { longestAbsence, presenceMatrix } from '../logic/stats'
import { SCENE_STATUS_LABEL, SEED_STATUS_LABEL } from '../model/labels'
import { SCENE_STATUSES, STORY_STRUCTURES, type SceneStatus } from '../model/schema'
import { byId, entityName, manuscriptOrder, moveScene, patch, placeScene, scenesOf, updateScene } from '../model/universe'
import { countWords } from '../persistence/repository'
import { useWorkspace } from '../state/workspace'
import { Empty, Select } from '../ui/bits'
import { PageHelp } from '../ui/PageTour'
import { saveMode, SceneFrame, SHIFT_LABEL, ShiftPicker, WritingModes } from './write/WritingModes'

type Tab = 'mapa' | 'presenca' | 'ritmo'

/**
 * O Mapa da escrita: a história vista de cima (atos, viradas, promessas e os cartões das cenas).
 * Só mostra e reorganiza; os avisos são perguntas, nunca cobrança.
 */
export default function OrganizeView() {
  const [tab, setTab] = useState<Tab>('mapa')
  const { universe, go } = useWorkspace()
  return (
    <div className="view organize-view">
      <header className="view-head view-head-wide map-view-head">
        <h1 className="sr-only">Mapa da história</h1>
        <WritingModes
          current="mapa"
          onPick={(m) => {
            if (m === 'mapa') return
            saveMode(m)
            go('escrever')
          }}
        />
        <PageHelp tour="organizar" />
        <div className="tabs tabs-inline" role="tablist" onKeyDown={tabListKeys}>
          {(
            [
              ['mapa', 'Cenas'],
              ['presenca', 'Presença'],
              ['ritmo', 'Ritmo'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {universe.scenes.length === 0 ? (
        <Empty icon={<PanelsTopLeft size={32} />} title="Nada para organizar ainda.">
          <p>Escreva algumas cenas; elas aparecem aqui como cartões.</p>
        </Empty>
      ) : tab === 'mapa' ? (
        <Corkboard />
      ) : tab === 'presenca' ? (
        <PresenceTab />
      ) : (
        <RhythmTab />
      )}
    </div>
  )
}

function Corkboard() {
  const { universe, update, go } = useWorkspace()
  const groups = [...universe.stories.map((s) => ({ id: s.id, title: s.title || 'Sem título' })), { id: null as string | null, title: 'Cenas soltas' }]
  // Arrastar pela alça (mouse ou dedo): mostra onde a cena vai cair e solta lá.
  const [drag, setDrag] = useState<{ id: string; story: string | null; before: string | null } | null>(null)
  const target = (x: number, y: number): { story: string | null; before: string | null } | null => {
    const el = document.elementFromPoint(x, y)
    const card = el?.closest<HTMLElement>('[data-scene]')
    const group = el?.closest<HTMLElement>('[data-group]')
    if (!group) return null
    const story = group.dataset.group === '' ? null : group.dataset.group!
    if (!card) return { story, before: null }
    const box = card.getBoundingClientRect()
    const after = x > box.left + box.width / 2
    // A próxima cena (pulando as divisões de ato entre os cartões).
    let sib = card.nextElementSibling as HTMLElement | null
    while (sib && !sib.dataset.scene) sib = sib.nextElementSibling as HTMLElement | null
    const next = after ? (sib?.dataset.scene ?? null) : card.dataset.scene!
    return { story, before: next }
  }
  const drop = () => {
    if (drag) update((u) => placeScene(u, drag.id, drag.story, drag.before))
    setDrag(null)
  }
  return (
    <div className={`corkboard${drag ? ' is-dragging' : ''}`}>
      {groups.map((g) => {
        const story = g.id ? byId(universe, 'stories', g.id) : undefined
        const structure: Structure = story?.structure ?? 'livre'
        const map = storyMap(universe, g.id, structure)
        const scenes = map.map((m) => m.scene)
        if (!scenes.length && g.id === null && !drag) return null
        const acts = STRUCTURES[structure].acts
        return (
          <section key={g.id ?? 'soltas'} className={`cork-group${drag && drag.story === g.id ? ' is-target' : ''}`} data-group={g.id ?? ''}>
            {story ? <StoryMap storyId={story.id} title={g.title} structure={structure} map={map} /> : <h2 className="section-title">{g.title}</h2>}
            <ol className="cork-cards">
              {map.flatMap((m, i) => [
                ...(m.act >= 0 && m.act !== map[i - 1]?.act
                  ? [
                      <li key={`ato-${m.act}`} className="cork-act">
                        {acts[m.act].name}
                      </li>,
                    ]
                  : []),
                sceneCard(m, i),
              ])}
              {drag && drag.story === g.id && drag.before === null && <li className="cork-drop-end" aria-hidden="true" />}
            </ol>
          </section>
        )
      })}
      <p className="muted tiny">Arraste pela alça ⠿ para mudar a ordem, ou para outra história. No teclado: setas na alça.</p>
    </div>
  )

  // Uma função, não um componente: assim o cartão não é recriado a cada letra digitada nele.
  function sceneCard(m: MapScene, i: number) {
    const s = m.scene
    const g = { id: s.storyId }
    const scenes = scenesOf(universe, s.storyId)
    const card = s.want.trim() || s.obstacle.trim() || s.outcome.trim()
    return (
      <li
        key={s.id}
        data-scene={s.id}
        className={`cork-card status-${s.status}${s.shift ? ` shift-${s.shift}` : ''}${drag?.id === s.id ? ' is-dragged' : ''}${drag && drag.story === g.id && drag.before === s.id && drag.id !== s.id ? ' drop-before' : ''}`}
      >
        <button
          type="button"
          className="cork-handle"
          aria-label={`Mover “${s.title || 'Sem título'}” (setas mudam a posição)`}
          title="Arraste para mudar a ordem"
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            setDrag({ id: s.id, story: g.id, before: scenes[i + 1]?.id ?? null })
          }}
          onPointerMove={(e) => {
            if (!drag) return
            const t = target(e.clientX, e.clientY)
            if (t && (t.story !== drag.story || t.before !== drag.before)) setDrag({ ...drag, ...t })
          }}
          onPointerUp={drop}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault()
              update((u) => moveScene(u, s.id, -1))
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault()
              update((u) => moveScene(u, s.id, 1))
            }
          }}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <span className="cork-num">{i + 1}</span>
        <button type="button" className="cork-title" onClick={() => go('escrever', s.id)}>
          {s.title || 'Sem título'}
        </button>
        {m.beats.length > 0 && (
          <p className="cork-beats">
            {m.beats.map((b) => (
              <span key={b} className="beat-chip">
                {b}
              </span>
            ))}
          </p>
        )}
        {!card && s.synopsis && <p className="cork-synopsis">{s.synopsis}</p>}
        <SceneFrame scene={s} />
        <div className="cork-meta">
          {s.povId && <span>POV {entityName(universe, s.povId)}</span>}
          {s.placeId && <span>{entityName(universe, s.placeId)}</span>}
        </div>
        <div className="cork-foot">
          <ShiftPicker scene={s} compact />
          <label className="sr-only" htmlFor={`cs-${s.id}`}>
            Estado
          </label>
          <Select<SceneStatus> id={`cs-${s.id}`} value={s.status} onChange={(v) => update((u) => updateScene(u, s.id, { status: v }))} options={SCENE_STATUSES.map((x) => ({ value: x, label: SCENE_STATUS_LABEL[x] }))} />
        </div>
      </li>
    )
  }
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`

/** O alto de cada história no Mapa: o modelo, a faixa das cenas, as promessas e o que vale olhar. */
function StoryMap({ storyId, title, structure, map }: { storyId: string; title: string; structure: Structure; map: MapScene[] }) {
  const { universe, update, go, readOnly } = useWorkspace()
  const lines = useMemo(() => promiseLines(universe, map), [universe, map])
  const notices = useMemo(() => mapNotices(universe, map, structure, lines), [universe, map, structure, lines])
  const missing = withoutCard(map).length
  const marked = map.filter((m) => m.scene.shift).length
  return (
    <div className="story-map">
      <div className="story-map-head">
        <h2 className="section-title">{title}</h2>
        <span className="muted small">
          {map.length} {map.length === 1 ? 'cena' : 'cenas'}
          {missing > 0 && ` · ${missing} sem cartão`}
        </span>
        <label className="story-map-structure small">
          <span className="muted">Modelo</span>
          {readOnly ? (
            <strong>{STRUCTURE_LABEL[structure]}</strong>
          ) : (
            <Select<Structure>
              value={structure}
              label={`Modelo de estrutura de “${title}”`}
              onChange={(v) => update((u) => patch(u, 'stories', storyId, { structure: v }))}
              options={STORY_STRUCTURES.map((x) => ({ value: x, label: STRUCTURE_LABEL[x] }))}
            />
          )}
        </label>
      </div>
      {map.length > 0 && <MapStrip map={map} structure={structure} />}
      {lines.length > 0 && <PromiseTracks lines={lines} />}
      {map.length > 0 && <Notices notices={notices} hint={marked === 0} onOpen={(id) => go('escrever', id)} />}
    </div>
  )
}

/** A faixa da história: cada cena do tamanho que tem, na cor de como termina, com atos e momentos. */
function MapStrip({ map, structure }: { map: MapScene[]; structure: Structure }) {
  const { acts, beats } = STRUCTURES[structure]
  // Só os nomes que cabem sem encostar no anterior; os outros ficam como traço (e aparecem nos cartões).
  const named = new Set(beats.reduce<typeof beats>((shown, b) => (shown.length && b.at - shown[shown.length - 1].at < 0.14 ? shown : [...shown, b]), []).map((b) => b.name))
  const jump = (id: string) => {
    const card = document.querySelector<HTMLElement>(`[data-scene="${id}"]`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    card?.querySelector<HTMLElement>('.cork-title')?.focus({ preventScroll: true })
  }
  return (
    <figure className="map-strip-wrap">
      {acts.length > 0 && (
        <div className="map-acts" aria-hidden="true">
          {acts.map((a) => (
            <span key={a.name} style={{ left: pct(a.from), width: pct(a.to - a.from) }}>
              {a.name}
            </span>
          ))}
        </div>
      )}
      <div className="map-strip">
        {map.map((m) => (
          <button
            key={m.scene.id}
            type="button"
            className={`map-seg shift-${m.scene.shift || 'sem'}`}
            style={{ left: pct(m.from), width: pct(m.to - m.from) }}
            aria-label={`${m.scene.title || 'Sem título'}: ${m.scene.shift ? `termina ${m.scene.shift}` : 'sem marca'}`}
            title={`${m.scene.title || 'Sem título'}${m.scene.shift ? ` · ${SHIFT_LABEL[m.scene.shift]}` : ''}`}
            onClick={() => jump(m.scene.id)}
          />
        ))}
        {acts.slice(1).map((a) => (
          <i key={a.name} className="map-act-line" style={{ left: pct(a.from) }} aria-hidden="true" />
        ))}
      </div>
      {beats.length > 0 && (
        <div className="map-beats" aria-hidden="true">
          {beats.map((b) => (
            <span key={b.name} className={b.at >= 0.85 ? 'is-end' : undefined} style={{ left: pct(b.at) }} title={b.name}>
              {named.has(b.name) && <em>{b.name}</em>}
            </span>
          ))}
        </div>
      )}
      <figcaption className="map-legend tiny muted">
        <span>
          <i className="shift-melhor" /> Melhor
        </span>
        <span>
          <i className="shift-pior" /> Pior
        </span>
        <span>
          <i className="shift-igual" /> Igual
        </span>
        <span>
          <i className="shift-sem" /> Sem marca
        </span>
        <span>A largura de cada cena é o tamanho dela no livro.</span>
      </figcaption>
    </figure>
  )
}

const POINT_LABEL: Record<PromiseLine['points'][number]['kind'], string> = { plantada: 'plantada', pista: 'pista', paga: 'paga' }

/** As promessas (pistas e mistérios) como linhas: onde foram plantadas, avançaram e foram pagas. */
function PromiseTracks({ lines }: { lines: PromiseLine[] }) {
  const { universe, go } = useWorkspace()
  const sceneTitle = (id: string) => byId(universe, 'scenes', id)?.title || 'Sem título'
  return (
    <section className="map-promises" aria-label="Promessas">
      <h3 className="section-label">
        Promessas <span className="tiny muted map-promises-key">○ plantada · • pista · ● paga</span>
      </h3>
      <ul>
        {lines.map((l) => {
          const first = l.points[0].at
          const end = l.points[l.points.length - 1].at
          return (
            <li key={l.seed.id} className={l.stalled ? 'is-stalled' : undefined}>
              <button type="button" className="link-btn map-promise-name" onClick={() => go('tramas', l.seed.id)}>
                {l.seed.title}
              </button>
              {l.stalled && <span className="tiny map-stalled">parada</span>}
              <span className="map-track" aria-hidden="true">
                <span className="map-track-line" style={{ left: pct(first), width: pct(end - first) }} />
                {l.stalled && <span className="map-track-stall" style={{ left: pct(end), width: pct(1 - end) }} />}
                {l.points.map((p, i) => (
                  <i key={i} className={`map-pt map-pt-${p.kind}`} style={{ left: pct(p.at) }} title={`${POINT_LABEL[p.kind]} em “${sceneTitle(p.sceneId)}”`} />
                ))}
              </span>
              <span className="sr-only">{l.points.map((p) => `${POINT_LABEL[p.kind]} em “${sceneTitle(p.sceneId)}”`).join(', ')}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** O que vale olhar: perguntas tiradas do que foi marcado e do que dá para contar. */
function Notices({ notices, hint, onOpen }: { notices: MapNotice[]; hint: boolean; onOpen: (sceneId: string) => void }) {
  if (!notices.length && !hint) return null
  return (
    <section className="map-notices" aria-label="Vale olhar">
      <h3 className="section-label">Vale olhar</h3>
      {hint && <p className="small muted">Marque como cada cena termina (melhor, pior ou igual) para ver o desenho da história na faixa.</p>}
      {notices.length > 0 && (
        <ul>
          {notices.map((n) => (
            <li key={n.text}>
              <span>{n.text}</span>
              {n.sceneId && (
                <button type="button" className="link-btn small" onClick={() => onOpen(n.sceneId!)}>
                  Abrir cena
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PresenceTab() {
  const { universe, go, peek } = useWorkspace()
  const { rows, columns } = useMemo(() => presenceMatrix(universe), [universe])
  if (!columns.length) return <p className="empty-inline">Nenhum personagem aparece nas cenas ainda.</p>
  return (
    <>
      <div className="legend small">
        <span>
          <span className="cell cell-pov" /> POV
        </span>
        <span>
          <span className="cell cell-presente" /> Presente
        </span>
        <span>
          <span className="cell cell-mencionado" /> Mencionado
        </span>
      </div>
      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Cena</th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="matrix-col">
                  <button type="button" className="link-btn" onClick={() => peek(c.id)}>
                    {c.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.scene.id}>
                <th scope="row">
                  <button type="button" className="link-btn" onClick={() => go('escrever', r.scene.id)}>
                    {r.scene.title || 'Sem título'}
                  </button>
                </th>
                {columns.map((c) => {
                  const v = r.cells.get(c.id)
                  return <td key={c.id}>{v && <span className={`cell cell-${v}`} title={v} aria-label={v} />}</td>
                })}
              </tr>
            ))}
            <tr className="matrix-foot">
              <th scope="row" className="small muted">
                Maior ausência (cenas)
              </th>
              {columns.map((c) => (
                <td key={c.id} className="tabular small">
                  {longestAbsence(rows, c.id) || '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function RhythmTab() {
  const { universe, go } = useWorkspace()
  const { rows } = useMemo(() => presenceMatrix(universe), [universe])
  const max = Math.max(1, ...rows.map((r) => r.words))
  const total = countWords(universe)
  const order = manuscriptOrder(universe)
  const pov = new Map<string, number>()
  for (const s of order) if (s.povId) pov.set(s.povId, (pov.get(s.povId) ?? 0) + 1)
  const openSeeds = universe.seeds
    .filter((s) => s.status === 'aberta' || s.status === 'parcial')
    .map((s) => {
      const i = order.findIndex((x) => x.id === s.setupSceneId)
      return { seed: s, age: i >= 0 ? order.length - 1 - i : null }
    })
    .sort((a, b) => (b.age ?? -1) - (a.age ?? -1))

  return (
    <div className="rhythm">
      <section>
        <h2 className="section-title">Tamanho das cenas</h2>
        <p className="muted small">{total.toLocaleString('pt-BR')} palavras no total.</p>
        <ol className="bars">
          {rows.map((r) => (
            <li key={r.scene.id}>
              <button type="button" className="bar-label link-btn" onClick={() => go('escrever', r.scene.id)}>
                {r.scene.title || 'Sem título'}
              </button>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${(r.words / max) * 100}%` }} />
              </span>
              <span className="tabular small">{r.words.toLocaleString('pt-BR')}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="section-title">Pontos de vista</h2>
        {pov.size === 0 ? (
          <p className="muted small">Nenhuma cena com POV definido.</p>
        ) : (
          <ul className="plain-list">
            {[...pov.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <li key={id}>
                  {byId(universe, 'entities', id)?.name ?? '?'} — {n} {n === 1 ? 'cena' : 'cenas'}
                </li>
              ))}
          </ul>
        )}
        <h2 className="section-title">Tramas em aberto</h2>
        {openSeeds.length === 0 ? (
          <p className="muted small">Nenhuma.</p>
        ) : (
          <ul className="plain-list">
            {openSeeds.map(({ seed, age }) => (
              <li key={seed.id}>
                <button type="button" className="link-btn" onClick={() => go('tramas', seed.id)}>
                  {seed.title}
                </button>{' '}
                <span className="muted small">
                  {SEED_STATUS_LABEL[seed.status]}
                  {age !== null && ` · plantada há ${age} ${age === 1 ? 'cena' : 'cenas'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
