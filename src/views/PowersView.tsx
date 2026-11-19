import { Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { levelsOf, powerIssues, powerKey, powersAt, POWER_TEMPLATES, systemsOf, templateNodes, type PowerHad, type PowerNode } from '../logic/powers'
import type { Entity, Scene } from '../model/schema'
import { draftEntity, entityName, insert, manuscriptOrder, newId, patch, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { EntityPicker } from '../ui/EntityPicker'

/*
 * Poderes e magia: a árvore do sistema (na ficha de "Sistema de magia") e os poderes de cada personagem,
 * que acendem conforme a régua da história.
 */

/** A árvore em níveis: quem não pede nada no alto; cada nó mostra o que pede, o custo e de quem é de nascença. */
export function PowerTree({ system, had, scenes = [], link, editable = false }: { system: Entity; had?: Map<string, PowerHad>; scenes?: Scene[]; link: (id: string) => React.ReactNode; editable?: boolean }) {
  const { prefs } = useWorkspace()
  // Nova cara: a árvore vira uma constelação (estrelas que acendem), como no Skyrim.
  if (prefs.novaCara) return <PowerSky system={system} had={had} scenes={scenes} link={link} editable={editable && !had} />
  const nodes = system.nodes ?? []
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? '?'
  return (
    <ol className="power-tree" aria-label={`Árvore de ${system.name || 'poderes'}`}>
      {levelsOf(nodes).map((level, i) => (
        <li key={i} className="power-level">
          <span className="power-level-n tiny muted">Nível {i + 1}</span>
          <ul>
            {level.map((n) => {
              const h = had?.get(powerKey(system.id, n.id))
              return (
                <li key={n.id} className={`power-node${had ? (h ? ' is-lit' : ' is-dark') : ''}`} aria-label={`${n.name}${had ? (h ? ', tem' : ', ainda não') : ''}`}>
                  <strong>
                    {h && <Sparkles size={13} aria-hidden="true" />} {n.name || 'Sem nome'}
                  </strong>
                  {n.summary && <span className="small">{n.summary}</span>}
                  {n.requires.length > 0 && <span className="tiny muted">pede {n.requires.map(name).join(' + ')}</span>}
                  {n.cost && <span className="tiny muted">custo: {n.cost}</span>}
                  {(n.innate ?? []).length > 0 && !had && (
                    <span className="tiny muted">
                      de nascença: {(n.innate ?? []).map((id, j) => (
                        <span key={id}>
                          {j > 0 && ', '}
                          {link(id)}
                        </span>
                      ))}
                    </span>
                  )}
                  {h && (
                    <span className="tiny power-how">
                      {h.how === 'nasceu' ? <>de nascença{h.from && <> ({h.from.name})</>}</> : h.at >= 0 ? <>aprende em “{sceneTitle(scenes[h.at])}”</> : 'desde o começo'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ol>
  )
}

/**
 * A constelação: cada nível da árvore é uma faixa do céu, as linhas são o que cada poder pede, e as estrelas
 * acesas são as que a ficha tem naquele ponto da história. Tocar numa estrela mostra a carta dela. Cada
 * estrela é um botão (o leitor de tela lê o nome e se está acesa).
 */
export function PowerSky({ system, had, scenes = [], link, editable = false }: { system: Entity; had?: Map<string, PowerHad>; scenes?: Scene[]; link: (id: string) => React.ReactNode; editable?: boolean }) {
  const { update } = useWorkspace()
  const nodes = system.nodes ?? []
  // Montar arrastando (quem escreve, na ficha do sistema): de uma estrela até outra = "esta pede aquela".
  const skyRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; moved: boolean } | null>(null)
  const toggleRequire = (from: string, to: string) =>
    update((u) => {
      const sys = u.entities.find((x) => x.id === system.id)
      if (!sys) return u
      return patch(u, 'entities', sys.id, {
        nodes: (sys.nodes ?? []).map((n) => (n.id !== to ? n : { ...n, requires: n.requires.includes(from) ? n.requires.filter((r) => r !== from) : [...n.requires, from] })),
      })
    })
  const relPos = (ev: React.PointerEvent) => {
    const r = skyRef.current!.getBoundingClientRect()
    return { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 }
  }
  const levels = levelsOf(nodes)
  const [picked, setPicked] = useState<string | null>(null)
  const pos = new Map<string, { x: number; y: number }>()
  levels.forEach((level, i) => level.forEach((n, j) => pos.set(n.id, { x: ((j + 0.5) / level.length) * 100, y: ((i + 0.5) / levels.length) * 100 })))
  const lit = (id: string) => !had || had.has(powerKey(system.id, id))
  const node = nodes.find((n) => n.id === picked)
  const h = node && had?.get(powerKey(system.id, node.id))
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? '?'
  const leadsTo = node ? nodes.filter((n) => n.requires.includes(node.id)) : []
  const count = had ? nodes.filter((n) => lit(n.id)).length : null
  return (
    <div className="power-sky-wrap">
      <p className="power-sky-title">
        <strong>{system.name || 'Poderes'}</strong>
        <span className="tiny muted">{count !== null ? `${count} de ${nodes.length} acesas · ` : ''}toque numa estrela</span>
      </p>
      {editable && <p className="tiny muted power-sky-hint">Arraste de uma estrela até outra para dizer que ela pede a primeira (de novo desfaz).</p>}
      <div
        ref={skyRef}
        className={`power-sky${editable ? ' is-editable' : ''}${drag?.moved ? ' is-linking' : ''}`}
        style={{ height: `${Math.max(2, levels.length) * 104}px` }}
        role="group"
        aria-label={`Constelação de ${system.name || 'poderes'}`}
        onPointerMove={(ev) => {
          if (!drag) return
          const p = relPos(ev)
          const far = Math.abs(p.x - (pos.get(drag.from)?.x ?? 0)) + Math.abs(p.y - (pos.get(drag.from)?.y ?? 0)) > 4
          setDrag({ ...drag, ...p, moved: drag.moved || far })
        }}
        onPointerUp={(ev) => {
          if (!drag) return
          if (drag.moved) {
            const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-node]')?.dataset.node
            if (target && target !== drag.from) toggleRequire(drag.from, target)
          }
          setDrag(null)
        }}
        onPointerLeave={() => setDrag(null)}
      >
        <svg className="power-sky-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {nodes.flatMap((n) =>
            n.requires.map((r) => {
              const a = pos.get(r)
              const b = pos.get(n.id)
              if (!a || !b) return null
              const on = lit(r) && lit(n.id)
              return <line key={`${r}-${n.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={on ? 'is-on' : ''} vectorEffect="non-scaling-stroke" />
            }),
          )}
          {drag?.moved && pos.get(drag.from) && <line x1={pos.get(drag.from)!.x} y1={pos.get(drag.from)!.y} x2={drag.x} y2={drag.y} className="is-drag" vectorEffect="non-scaling-stroke" />}
        </svg>
        {nodes.map((n) => {
          const p = pos.get(n.id)!
          const on = lit(n.id)
          return (
            <button
              key={n.id}
              type="button"
              className={`star${on ? ' is-on' : ''}${picked === n.id ? ' is-picked' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-label={`${n.name || 'Sem nome'}${had ? (on ? ', acesa' : ', apagada') : ''}`}
              aria-pressed={picked === n.id}
              data-node={n.id}
              onPointerDown={() => {
                if (!editable) return
                const p = pos.get(n.id)!
                setDrag({ from: n.id, x: p.x, y: p.y, moved: false })
              }}
              onClick={() => {
                if (drag?.moved) return
                setPicked(picked === n.id ? null : n.id)
              }}
            >
              <span className="star-dot" aria-hidden="true" />
              <span className="star-name">{n.name || 'Sem nome'}</span>
            </button>
          )
        })}
      </div>
      {node && (
        <div className="star-card" role="region" aria-label={`Poder: ${node.name || 'Sem nome'}`}>
          <h3>{node.name || 'Sem nome'}</h3>
          {node.summary && <p>{node.summary}</p>}
          <p className="star-card-chips">
            {h && <span className="chip ok">✓ {h.how === 'nasceu' ? `de nascença${h.from ? ` (${h.from.name})` : ''}` : h.at >= 0 ? `aprende em “${sceneTitle(scenes[h.at])}”` : 'desde o começo'}</span>}
            {had && !h && <span className="chip">ainda não tem</span>}
            {node.requires.length > 0 && <span className="chip">pede: {node.requires.map(name).join(' + ')}</span>}
            {leadsTo.length > 0 && <span className="chip">leva a: {leadsTo.map((x) => x.name).join(', ')}</span>}
            {node.cost && <span className="chip">custo: {node.cost}</span>}
            {(node.innate ?? []).map((id) => (
              <span key={id} className="chip">
                de nascença: {link(id)}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

/** Montar a árvore: um modelo pronto para começar, e cada nó com o que pede, custo e de quem é de nascença. */
export function PowerTreeEditor({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const nodes = e.nodes ?? []
  const save = (fn: (ns: PowerNode[]) => PowerNode[]) =>
    update((u) => {
      const x = u.entities.find((y) => y.id === e.id)
      return x ? patch(u, 'entities', x.id, { nodes: fn(x.nodes ?? []) }) : u
    })
  const change = (id: string, changes: Partial<PowerNode>) => save((ns) => ns.map((n) => (n.id === id ? { ...n, ...changes } : n)))
  return (
    <div className="power-edit">
      {!nodes.length && (
        <div role="group" aria-label="Começar com um modelo">
          <p className="small muted">Cada mundo tem o seu sistema. Comece com um modelo (dá para mudar tudo) ou em branco.</p>
          <div className="chips">
            {POWER_TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="chip" title={t.hint} onClick={() => save(() => templateNodes(t.id))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {nodes.map((n) => (
        <div key={n.id} className="power-node-edit" role="group" aria-label={`Poder ${n.name || 'sem nome'}`}>
          <div className="row">
            <input className="input" aria-label="Nome do poder" placeholder="Nome do poder" value={n.name} onChange={(ev) => change(n.id, { name: ev.target.value })} />
            <button type="button" className="btn-icon btn-sm" aria-label={`Tirar ${n.name || 'o poder'}`} onClick={() => save((ns) => ns.filter((x) => x.id !== n.id).map((x) => ({ ...x, requires: x.requires.filter((r) => r !== n.id) })))}>
              <Trash2 size={14} />
            </button>
          </div>
          <input className="input" aria-label="O que faz" placeholder="O que faz (opcional)" value={n.summary ?? ''} onChange={(ev) => change(n.id, { summary: ev.target.value })} />
          <input className="input" aria-label="Custo ou condição" placeholder="Custo ou condição: um juramento, mana, um ano de vida…" value={n.cost ?? ''} onChange={(ev) => change(n.id, { cost: ev.target.value })} />
          {nodes.length > 1 && (
            <div role="group" aria-label={`O que ${n.name || 'este poder'} pede antes`}>
              <span className="tiny muted">Pede antes:</span>{' '}
              <span className="chips">
                {nodes
                  .filter((x) => x.id !== n.id)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className="chip"
                      aria-pressed={n.requires.includes(x.id)}
                      onClick={() => change(n.id, { requires: n.requires.includes(x.id) ? n.requires.filter((r) => r !== x.id) : [...n.requires, x.id] })}
                    >
                      {x.name || 'Sem nome'}
                    </button>
                  ))}
              </span>
            </div>
          )}
          <div className="power-innate">
            <span className="tiny muted">De nascença para:</span>{' '}
            {(n.innate ?? []).map((id) => (
              <button key={id} type="button" className="chip" aria-label={`Tirar ${entityName(universe, id)} de “de nascença”`} onClick={() => change(n.id, { innate: (n.innate ?? []).filter((x) => x !== id) })}>
                {entityName(universe, id)} ×
              </button>
            ))}
            <EntityPicker
              value={null}
              label={`De nascença para (${n.name || 'poder'})`}
              hideLabel
              placeholder="Uma espécie, linhagem, clã…"
              exclude={[e.id, ...(n.innate ?? [])]}
              allowCreate={false}
              onChange={(id) => id && change(n.id, { innate: [...(n.innate ?? []), id] })}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => save((ns) => [...ns, { id: newId(), name: '', requires: [] }])}>
        <Plus size={14} aria-hidden="true" /> Novo poder
      </button>
    </div>
  )
}

/** Os poderes do personagem naquele ponto da história, por sistema, e o que não fecha (para o autor). */
export function CharacterPowers({ entity: e, index, reader, link }: { entity: Entity; index: number; reader: boolean; link: (id: string) => React.ReactNode }) {
  const { universe, prefs } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const had = powersAt(universe, e, index, scenes, reader)
  const systems = systemsOf(universe).filter((s) => (s.nodes ?? []).some((n) => had.has(powerKey(s.id, n.id))) || (e.learned ?? []).some((l) => l.systemId === s.id))
  const issues = reader ? [] : powerIssues(universe, e, scenes)
  if (!systems.length) return null
  return (
    <section className="powers-read" aria-label="Poderes">
      <h2>Poderes</h2>
      {systems.map((s) => (
        <div key={s.id}>
          <p className={`small${prefs.novaCara ? ' sr-only' : ''}`}>
            <strong>{link(s.id)}</strong> · {(s.nodes ?? []).filter((n) => had.has(powerKey(s.id, n.id))).length} de {(s.nodes ?? []).length}
          </p>
          <PowerTree system={s} had={had} scenes={scenes} link={link} />
        </div>
      ))}
      {issues.length > 0 && (
        <ul className="power-issues small" aria-label="O que não fecha nos poderes">
          {issues.map((i) => (
            <li key={i}>
              <TriangleAlert size={13} aria-hidden="true" /> {i}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Ainda não há sistema de poderes no mundo: cria um aqui mesmo, a partir de um modelo (vira uma ficha de
 * "Sistema de magia", onde a árvore se edita depois). Assim ninguém precisa saber onde ele mora para começar.
 */
function NewSystem() {
  const { update, go } = useWorkspace()
  const [name, setName] = useState('Magia')
  const create = (template: string) =>
    update((u) => insert(u, 'entities', { ...draftEntity('magia', name.trim() || 'Magia'), nodes: templateNodes(template) })[0])
  return (
    <div className="power-new" role="group" aria-label="Criar o sistema de poderes">
      <p className="small">Este mundo ainda não tem sistema de poderes. Dê um nome e escolha como ele funciona (dá para mudar tudo depois):</p>
      <input className="input" aria-label="Nome do sistema" value={name} onChange={(ev) => setName(ev.target.value)} />
      <div className="chips">
        {POWER_TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="chip" title={t.hint} onClick={() => create(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="tiny muted">
        A árvore fica numa ficha de “Sistema de magia”.{' '}
        <button type="button" className="link-btn" onClick={() => go('fichas', null)}>
          Ver as fichas
        </button>
      </p>
    </div>
  )
}

/** Escolher os poderes do personagem e em que cena aprende cada um. Os de nascença vêm sozinhos. */
export function CharacterPowersEditor({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const systems = systemsOf(universe)
  const born = powersAt(universe, { ...e, learned: [] }, scenes.length - 1, scenes)
  const learned = e.learned ?? []
  const save = (next: NonNullable<Entity['learned']>) => update((u) => patch(u, 'entities', e.id, { learned: next }))
  if (!systems.length) return <NewSystem />
  return (
    <div className="power-learn">
      {systems.map((s) => (
        <fieldset key={s.id} className="power-learn-system">
          <legend>{s.name || 'Sistema'}</legend>
          {(s.nodes ?? []).map((n) => {
            const k = powerKey(s.id, n.id)
            const mine = learned.find((l) => l.systemId === s.id && l.nodeId === n.id)
            if (born.has(k))
              return (
                <p key={n.id} className="small">
                  <Sparkles size={13} aria-hidden="true" /> {n.name} <span className="muted">· de nascença ({born.get(k)?.from?.name})</span>
                </p>
              )
            return (
              <div key={n.id} className="power-learn-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!mine}
                    onChange={(ev) => {
                      const on = ev.target.checked
                      save(on ? [...learned, { systemId: s.id, nodeId: n.id, sceneId: null }] : learned.filter((l) => l !== mine))
                    }}
                  />{' '}
                  {n.name || 'Sem nome'}
                </label>
                {mine && (
                  <select
                    className="input select"
                    aria-label={`Aprende ${n.name} em`}
                    value={mine.sceneId ?? ''}
                    onChange={(ev) => save(learned.map((l) => (l === mine ? { ...l, sceneId: ev.target.value || null } : l)))}
                  >
                    <option value="">Desde o começo</option>
                    {scenes.map((sc, i) => (
                      <option key={sc.id} value={sc.id}>
                        {i + 1}. {sceneTitle(sc)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}
