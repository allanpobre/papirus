import { useMemo, useState } from 'react'
import { isOpen, type Question } from '../../logic/continuity'
import { findCandidates, type Candidate } from '../../logic/detection'
import { snippet } from '../../logic/text'
import { KIND_LABEL } from '../../model/labels'
import { ENTITY_KINDS, type Scene } from '../../model/schema'
import { byId, draftEntity, insert, manuscriptOrder, patch } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Select } from '../../ui/bits'
import { EntityPicker } from '../../ui/EntityPicker'
import { Modal } from '../../ui/Modal'
import { QuestionCard } from './QuestionCard'

type Tab = 'nomes' | 'perguntas' | 'pendentes'

/**
 * Revisão sob demanda: nomes novos, perguntas de continuidade e pendências.
 * Tudo pode ser resolvido em lote, ou deixado para depois.
 */
export function ReviewDialog({ scene, questions, onClose }: { scene: Scene; questions: Question[]; onClose: () => void }) {
  const { universe, update, toast, go } = useWorkspace()
  const [tab, setTab] = useState<Tab>('nomes')
  const [scope, setScope] = useState<'cena' | 'tudo'>('cena')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkKind, setBulkKind] = useState('personagem')

  const candidates = useMemo(() => {
    const scenes = scope === 'cena' ? [scene] : manuscriptOrder(universe)
    const merged = new Map<string, Candidate & { sceneId: string; source: string }>()
    for (const s of scenes) {
      for (const c of findCandidates(s.text, universe.entities, universe.settings.ignoredNames)) {
        const prev = merged.get(c.text)
        if (prev) prev.count += c.count
        else merged.set(c.text, { ...c, sceneId: s.id, source: s.text })
      }
    }
    return [...merged.values()].filter((c) => !hidden.has(c.text)).sort((a, b) => b.count - a.count)
  }, [scope, scene, universe, hidden])

  const openQuestions = questions.filter(isOpen)
  const errors = questions.filter((q) => q.answer?.answer === 'erro')
  const draftFacts = universe.facts.filter((f) => f.editorial === 'rascunho')
  const inbox = universe.inbox.filter((i) => i.status === 'aberto')

  const hide = (texts: string[]) => {
    setHidden((h) => new Set([...h, ...texts]))
    setSelected((s) => new Set([...s].filter((t) => !texts.includes(t))))
  }
  const create = (texts: string[], kind: string) => {
    update((u) => texts.reduce((acc, t) => insert(acc, 'entities', draftEntity(kind, t))[0], u))
    toast(texts.length === 1 ? `Ficha “${texts[0]}” criada em rascunho` : `${texts.length} fichas criadas em rascunho`)
    hide(texts)
  }
  const ignore = (texts: string[]) => {
    update((u) => ({ ...u, settings: { ...u.settings, ignoredNames: [...new Set([...u.settings.ignoredNames, ...texts])] } }))
    hide(texts)
  }
  const alias = (text: string, entityId: string) => {
    const e = byId(universe, 'entities', entityId)
    if (!e) return
    update((u) => patch(u, 'entities', entityId, { aliases: [...e.aliases, text] }))
    toast(`“${text}” agora é um nome de ${e.name}`)
    hide([text])
  }

  return (
    <Modal title="Revisão" onClose={onClose} size="lg">
      <div className="tabs" role="tablist">
        {(
          [
            ['nomes', `Nomes novos (${candidates.length})`],
            ['perguntas', `Perguntas (${openQuestions.length})`],
            ['pendentes', `Pendências (${errors.length + draftFacts.length + inbox.length})`],
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'nomes' && (
        <div className="review-names">
          <div className="review-toolbar">
            <div className="segmented" role="radiogroup" aria-label="Onde procurar">
              <button type="button" role="radio" aria-checked={scope === 'cena'} onClick={() => setScope('cena')}>
                Nesta cena
              </button>
              <button type="button" role="radio" aria-checked={scope === 'tudo'} onClick={() => setScope('tudo')}>
                Todo o manuscrito
              </button>
            </div>
            {selected.size > 0 && (
              <div className="review-bulk">
                <span className="small">{selected.size} selecionados</span>
                <Select label="Tipo para as novas fichas" value={bulkKind} onChange={setBulkKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
                <button type="button" className="btn btn-sm btn-primary" onClick={() => create([...selected], bulkKind)}>
                  Criar fichas
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => ignore([...selected])}>
                  Ignorar
                </button>
              </div>
            )}
          </div>
          <p className="muted small">
            Heurística simples: palavras com maiúscula no meio da frase. Pode errar. Nada é criado sem o seu clique.
          </p>
          {candidates.length === 0 ? (
            <p className="empty-inline">Nenhum nome novo por aqui.</p>
          ) : (
            <ul className="candidates">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.text}
                  c={c}
                  checked={selected.has(c.text)}
                  onCheck={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(c.text); else n.delete(c.text); return n })}
                  onCreate={(kind) => create([c.text], kind)}
                  onAlias={(id) => alias(c.text, id)}
                  onIgnore={() => ignore([c.text])}
                  onLater={() => hide([c.text])}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'perguntas' &&
        (openQuestions.length === 0 ? (
          <p className="empty-inline">Nenhuma pergunta em aberto. Mistérios intencionais nunca aparecem aqui.</p>
        ) : (
          <div className="question-list">
            {openQuestions.map((q) => (
              <QuestionCard key={q.key} q={q} />
            ))}
          </div>
        ))}

      {tab === 'pendentes' && (
        <div className="pending">
          <h3 className="section-label">Para corrigir ({errors.length})</h3>
          {errors.length === 0 ? <p className="muted small">Nada marcado como erro.</p> : errors.map((q) => <QuestionCard key={q.key} q={q} />)}
          <h3 className="section-label">Fatos em rascunho ({draftFacts.length})</h3>
          {draftFacts.length === 0 ? (
            <p className="muted small">Nenhum.</p>
          ) : (
            <button type="button" className="link-btn" onClick={() => { onClose(); go('conhecimento') }}>
              Revisar na área Conhecimento
            </button>
          )}
          <h3 className="section-label">Inbox ({inbox.length})</h3>
          {inbox.length === 0 ? (
            <p className="muted small">Inbox vazia.</p>
          ) : (
            <button type="button" className="link-btn" onClick={() => { onClose(); go('inbox') }}>
              Abrir a Inbox
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

function CandidateRow({
  c,
  checked,
  onCheck,
  onCreate,
  onAlias,
  onIgnore,
  onLater,
}: {
  c: Candidate & { source: string }
  checked: boolean
  onCheck: (v: boolean) => void
  onCreate: (kind: string) => void
  onAlias: (entityId: string) => void
  onIgnore: () => void
  onLater: () => void
}) {
  const [kind, setKind] = useState('personagem')
  const [aliasing, setAliasing] = useState(false)
  return (
    <li className="candidate">
      <label className="candidate-check">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        <span className="candidate-name">{c.text}</span>
        <span className="muted small">×{c.count}</span>
      </label>
      <p className="candidate-context">{snippet(c.source, c.index, c.index + c.text.length, 50)}</p>
      <div className="candidate-actions">
        {aliasing ? (
          <EntityPicker label={`“${c.text}” é outro nome de…`} value={null} allowCreate={false} onChange={(id) => id && onAlias(id)} />
        ) : (
          <>
            <Select label={`Tipo de ${c.text}`} value={kind} onChange={setKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onCreate(kind)}>
              Criar ficha
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAliasing(true)}>
              É outro nome de…
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onLater}>
              Deixar em aberto
            </button>
            <button type="button" className="btn btn-sm btn-ghost" title="Nunca mais sugerir" onClick={onIgnore}>
              Ignorar
            </button>
          </>
        )}
      </div>
    </li>
  )
}
