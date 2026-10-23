import { PanelsTopLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { longestAbsence, presenceMatrix } from '../logic/stats'
import { SCENE_STATUS_LABEL, SEED_STATUS_LABEL } from '../model/labels'
import { SCENE_STATUSES, type SceneStatus } from '../model/schema'
import { byId, entityName, manuscriptOrder, updateScene } from '../model/universe'
import { countWords } from '../persistence/repository'
import { useWorkspace } from '../state/workspace'
import { Empty, Select } from '../ui/bits'

type Tab = 'quadro' | 'presenca' | 'ritmo'

/** Organizar: visão de cima do manuscrito. Só leitura e reorganização; nunca cobra nada. */
export default function OrganizeView() {
  const [tab, setTab] = useState<Tab>('quadro')
  const { universe } = useWorkspace()
  return (
    <div className="view organize-view">
      <header className="view-head view-head-wide">
        <h1>Organizar</h1>
        <div className="tabs tabs-inline" role="tablist">
          {(
            [
              ['quadro', 'Quadro de cenas'],
              ['presenca', 'Presença'],
              ['ritmo', 'Ritmo'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {universe.scenes.length === 0 ? (
        <Empty icon={<PanelsTopLeft size={32} />} title="Nada para organizar ainda.">
          <p>Escreva algumas cenas; elas aparecem aqui como cartões.</p>
        </Empty>
      ) : tab === 'quadro' ? (
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
  const groups = [
    ...universe.stories.map((s) => ({ id: s.id, title: s.title || 'Sem título' })),
    { id: null as string | null, title: 'Cenas soltas' },
  ]
  return (
    <div className="corkboard">
      {groups.map((g) => {
        const scenes = universe.scenes.filter((s) => s.storyId === g.id).sort((a, b) => a.order - b.order)
        if (!scenes.length && g.id === null) return null
        return (
          <section key={g.id ?? 'soltas'} className="cork-group">
            <h2 className="section-title">{g.title}</h2>
            <ol className="cork-cards">
              {scenes.map((s, i) => (
                <li key={s.id} className={`cork-card status-${s.status}`}>
                  <span className="cork-num">{i + 1}</span>
                  <button type="button" className="cork-title" onClick={() => go('escrever', s.id)}>
                    {s.title || 'Sem título'}
                  </button>
                  <p className="cork-synopsis">{s.synopsis || <span className="muted">Sem sinopse.</span>}</p>
                  <div className="cork-meta">
                    {s.povId && <span>POV {entityName(universe, s.povId)}</span>}
                    {s.placeId && <span>{entityName(universe, s.placeId)}</span>}
                  </div>
                  <label className="sr-only" htmlFor={`cs-${s.id}`}>
                    Estado
                  </label>
                  <Select<SceneStatus>
                    id={`cs-${s.id}`}
                    value={s.status}
                    onChange={(v) => update((u) => updateScene(u, s.id, { status: v }))}
                    options={SCENE_STATUSES.map((x) => ({ value: x, label: SCENE_STATUS_LABEL[x] }))}
                  />
                </li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

function PresenceTab() {
  const { universe, go, peek } = useWorkspace()
  const { rows, columns } = useMemo(() => presenceMatrix(universe), [universe])
  if (!columns.length) return <p className="empty-inline">Nenhum personagem aparece nas cenas ainda.</p>
  return (
    <>
      <div className="legend small">
        <span><span className="cell cell-pov" /> POV</span>
        <span><span className="cell cell-presente" /> Presente</span>
        <span><span className="cell cell-mencionado" /> Mencionado</span>
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
                  return (
                    <td key={c.id}>
                      {v && <span className={`cell cell-${v}`} title={v} aria-label={v} />}
                    </td>
                  )
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
