import { Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react'
import { tabListKeys } from '../ui/keys'
import { useMemo, useState } from 'react'
import { factSentence } from '../logic/codex'
import { holdersOf, knowledgeAt, readerKnowsAt } from '../logic/knowledge'
import { fold } from '../logic/text'
import { CANON_LABEL, CANON_ORDER, KNOWLEDGE_LABEL } from '../model/labels'
import type { Canon, KnowledgeState } from '../model/schema'
import { byId, entityName, manuscriptOrder, removeFact } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { CanonBadge, Empty, Field, Select } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { EntityPicker } from '../ui/EntityPicker'
import { FactDialog } from '../ui/FactDialog'
import { AreaHead } from './AreaModes'

type Tab = 'fatos' | 'leitor' | 'pov' | 'divergencias'

/** Cada fato numa frase: o que é verdade, dito do jeito mais simples. */
const TRUTH: Record<Canon, string> = {
  estabelecido: 'É verdade.',
  secreto: 'É verdade, mas é segredo.',
  rumor: 'É boato.',
  lenda: 'É lenda.',
  disputado: 'As fontes discordam.',
  falso: 'É mentira.',
  desconhecido: 'Você ainda não decidiu se é verdade.',
}

const KNOWLEDGE_VERB: Record<KnowledgeState, string> = { sabe: 'sabe', suspeita: 'suspeita', acredita: 'acredita', esqueceu: 'esqueceu' }

export default function KnowledgeView() {
  const [tab, setTab] = useState<Tab>('fatos')
  return (
    <div className="view knowledge-view">
      <AreaHead current="conhecimento" tour="conhecimento" />
      <header className="view-head view-head-wide area-tools">
        <div className="tabs tabs-inline" role="tablist" onKeyDown={tabListKeys}>
          {(
            [
              ['fatos', 'Fatos'],
              ['pov', 'Por personagem'],
              ['leitor', 'O que o leitor sabe'],
              ['divergencias', 'Versões que divergem'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <p className="muted small view-lede">
        A verdade do autor, o que personagens sabem ou acreditam, e o que o leitor já viu são coisas separadas — e ficam separadas aqui.
      </p>
      {tab === 'fatos' && <FactsTab />}
      {tab === 'pov' && <PovTab />}
      {tab === 'leitor' && <ReaderTab />}
      {tab === 'divergencias' && <DivergenceTab />}
    </div>
  )
}

function FactsTab() {
  const { universe, undoable, go } = useWorkspace()
  const [query, setQuery] = useState('')
  const [canon, setCanon] = useState<'todos' | Canon>('todos')
  const [editing, setEditing] = useState<string | 'novo' | null>(null)

  const facts = useMemo(() => {
    const q = fold(query.trim())
    return universe.facts
      .filter((f) => canon === 'todos' || f.canon === canon)
      .filter((f) => !q || fold(factSentence(universe, f) + ' ' + f.quote + ' ' + f.note).includes(q))
  }, [universe, query, canon])
  // O que o leitor já viu ao fim do que está escrito.
  const lastScene = manuscriptOrder(universe).at(-1)?.id
  const hasScenes = Boolean(lastScene)
  const readerSaw = useMemo(() => new Set(lastScene ? readerKnowsAt(universe, lastScene).map((f) => f.id) : []), [universe, lastScene])

  const fact = editing && editing !== 'novo' ? byId(universe, 'facts', editing) : undefined

  return (
    <>
      <div className="filters-row">
        <input className="input" data-livre aria-label="Filtrar fatos" placeholder="Filtrar…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select label="É verdade?" value={canon} onChange={setCanon} options={[{ value: 'todos', label: 'Verdade ou não' }, ...CANON_ORDER.map((c) => ({ value: c, label: CANON_LABEL[c] }))]} />
        <button type="button" className="btn btn-primary" onClick={() => setEditing('novo')}>
          <Plus size={16} /> Fato
        </button>
      </div>
      {universe.facts.length === 0 ? (
        <Empty icon={<Lightbulb size={32} />} title="Nenhum fato registrado.">
          <p>No editor, selecione um trecho e escolha “Fato”. O trecho fica guardado como fonte.</p>
        </Empty>
      ) : (
        <ul className="fact-cards">
          {facts.map((f) => {
            const holders = holdersOf(universe, f.id)
            const scene = byId(universe, 'scenes', f.sourceSceneId)
            const sceneLink = scene && (
              <button type="button" className="link-btn" onClick={() => go('escrever', scene.id)}>
                {scene.title || 'Sem título'}
              </button>
            )
            return (
              <li key={f.id} className={`fact-card fact-${f.canon}`}>
                <p className="fact-card-text">
                  <strong>{factSentence(universe, f)}.</strong> {TRUTH[f.canon]}{' '}
                  {f.speakerId ? (
                    <>
                      {entityName(universe, f.speakerId)} disse{sceneLink && <> em {sceneLink}</>}.
                    </>
                  ) : (
                    sceneLink && <>Aparece em {sceneLink}.</>
                  )}
                </p>
                {f.quote && <p className="fact-quote">“{f.quote}”</p>}
                <div className="fact-who">
                  {holders.map((k) => (
                    <span key={k.id} className={`chip knows-chip knows-${k.state}`}>
                      {entityName(universe, k.holderId)} {KNOWLEDGE_VERB[k.state]}
                    </span>
                  ))}
                  {hasScenes && <span className={`chip reader-chip${readerSaw.has(f.id) ? ' is-seen' : ''}`}>{readerSaw.has(f.id) ? 'o leitor viu' : 'o leitor ainda não'}</span>}
                </div>
                <span className="row-actions">
                  <button type="button" className="btn-icon btn-sm" aria-label="Editar fato" onClick={() => setEditing(f.id)}>
                    <Pencil size={14} />
                  </button>
                  <ConfirmButton className="btn-icon btn-sm" title="Apagar fato" question="Apagar?" confirmLabel="Apagar" onConfirm={() => undoable('Fato apagado', (u) => removeFact(u, f.id))}>
                    <Trash2 size={14} aria-label="Apagar fato" />
                  </ConfirmButton>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {editing === 'novo' && <FactDialog initial={{}} onClose={() => setEditing(null)} />}
      {fact && <FactDialog initial={fact} factId={fact.id} title="Editar fato" onClose={() => setEditing(null)} />}
    </>
  )
}

function PovTab() {
  const { universe } = useWorkspace()
  const [holder, setHolder] = useState<string | null>(universe.scenes.find((s) => s.povId)?.povId ?? null)
  const [sceneId, setSceneId] = useState('')
  const order = manuscriptOrder(universe)
  const known = holder ? knowledgeAt(universe, holder, sceneId || null) : []

  return (
    <>
      <div className="filters-row">
        <EntityPicker label="Personagem ou grupo" value={holder} onChange={setHolder} allowCreate={false} />
        <Field label="No ponto da história">
          {(id) => <Select id={id} value={sceneId} onChange={setSceneId} options={[{ value: '', label: 'Ao final de tudo' }, ...order.map((s) => ({ value: s.id, label: `Em “${s.title || 'Sem título'}”` }))]} />}
        </Field>
      </div>
      {!holder ? (
        <p className="empty-inline">Escolha um personagem para ver o que ele sabe, suspeita ou acredita.</p>
      ) : known.length === 0 ? (
        <p className="empty-inline">Nada registrado para {entityName(universe, holder)} até aqui. Registre na ficha, em “O que sabe”.</p>
      ) : (
        <ul className="know-cards">
          {known.map(({ fact, entry }) => (
            <li key={entry.id} className={`know-card knows-${entry.state}`}>
              <span className={`knows knows-${entry.state}`}>{KNOWLEDGE_LABEL[entry.state]}</span>
              <span>{factSentence(universe, fact)}</span>
              <CanonBadge canon={fact.canon} />
              {entry.state === 'acredita' && fact.canon !== 'falso' && <span className="muted tiny">Atenção: crença registrada sobre algo que não está marcado como falso.</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ReaderTab() {
  const { universe } = useWorkspace()
  const order = manuscriptOrder(universe)
  const [sceneId, setSceneId] = useState(order[0]?.id ?? '')
  const knows = sceneId ? readerKnowsAt(universe, sceneId) : []
  const knownIds = new Set(knows.map((f) => f.id))
  const hidden = universe.facts.filter((f) => !knownIds.has(f.id) && (f.canon === 'secreto' || f.canon === 'estabelecido'))

  if (!order.length) return <p className="empty-inline">Escreva algumas cenas primeiro.</p>

  return (
    <>
      <div className="filters-row">
        <Field label="Ao terminar a cena">
          {(id) => <Select id={id} value={sceneId} onChange={setSceneId} options={order.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.title || 'Sem título'}` }))} />}
        </Field>
      </div>
      <div className="two-cols">
        <section>
          <h2 className="section-title">O leitor já viu ({knows.length})</h2>
          <ul className="plain-list">
            {knows.map((f) => (
              <li key={f.id}>
                {factSentence(universe, f)} <CanonBadge canon={f.canon} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="section-title">Ainda escondido do leitor ({hidden.length})</h2>
          <p className="muted small">Fatos que você conhece mas que nenhuma cena até aqui mostrou.</p>
          <ul className="plain-list">
            {hidden.map((f) => (
              <li key={f.id}>
                {factSentence(universe, f)} <CanonBadge canon={f.canon} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function DivergenceTab() {
  const { universe } = useWorkspace()
  const groups = useMemo(() => {
    const map = new Map<string, typeof universe.facts>()
    for (const f of universe.facts) {
      if (!f.subjectId || !f.predicate.trim()) continue
      const k = `${f.subjectId}|${fold(f.predicate.trim())}`
      map.set(k, [...(map.get(k) ?? []), f])
    }
    return [...map.values()].filter((fs) => new Set(fs.map((f) => f.objectId ?? fold(f.value.trim()))).size > 1)
  }, [universe])

  if (!groups.length) return <p className="empty-inline">Nenhuma versão divergente. Quando fontes discordarem, elas aparecem lado a lado aqui.</p>

  return (
    <div className="divergences">
      {groups.map((fs) => (
        <section key={fs[0].id} className="divergence">
          <h2 className="section-title">
            {entityName(universe, fs[0].subjectId)} {fs[0].predicate}…
          </h2>
          <ul className="plain-list">
            {fs.map((f) => (
              <li key={f.id}>
                <strong>{f.objectId ? entityName(universe, f.objectId) : f.value}</strong> — segundo {f.speakerId ? entityName(universe, f.speakerId) : 'o narrador'} <CanonBadge canon={f.canon} />
              </li>
            ))}
          </ul>
          <p className="muted tiny">O Papirus não decide qual versão é verdadeira. Ajuste o canon de cada fato quando quiser.</p>
        </section>
      ))}
    </div>
  )
}
