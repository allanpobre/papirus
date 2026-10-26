import { HelpCircle, Plus, Sprout, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SEED_STATUS_LABEL } from '../model/labels'
import { SEED_STATUSES, type Seed, type SeedStatus } from '../model/schema'
import { byId, draftSeed, entityName, insert, manuscriptOrder, newId, patch, remove } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Empty, Field, Select } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { EntityMultiPicker } from '../ui/EntityPicker'
import { Modal } from '../ui/Modal'

export default function SeedsView() {
  const { universe, update, nav } = useWorkspace()
  const [kind, setKind] = useState<'todas' | Seed['kind']>('todas')
  const [title, setTitle] = useState('')
  const [newKind, setNewKind] = useState<Seed['kind']>('semente')
  const [open, setOpen] = useState<string | null>(nav.view === 'tramas' ? (nav.id ?? null) : null)

  const seeds = universe.seeds.filter((s) => kind === 'todas' || s.kind === kind)
  const opened = open ? byId(universe, 'seeds', open) : undefined

  const move = (id: string, status: SeedStatus) => update((u) => patch(u, 'seeds', id, { status }))

  return (
    <div className="view seeds-view">
      <header className="view-head view-head-wide">
        <h1>Pistas e mistérios</h1>
        <form
          className="quick-create"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            update((u) => insert(u, 'seeds', draftSeed(title.trim(), newKind))[0])
            setTitle('')
          }}
        >
          <label htmlFor="nova-trama" className="sr-only">
            Nova trama
          </label>
          <input id="nova-trama" className="input" placeholder="Uma promessa ao leitor, uma pergunta…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select
            label="Tipo"
            value={newKind}
            onChange={setNewKind}
            options={[
              { value: 'semente', label: 'Semente' },
              { value: 'misterio', label: 'Mistério' },
            ]}
          />
          <button type="submit" className="btn btn-primary" aria-label="Criar">
            <Plus size={16} />
          </button>
        </form>
      </header>
      <p className="muted small view-lede">
        Sementes ligam uma preparação a um pagamento futuro. Mistérios reúnem pistas. Nenhum precisa ser resolvido.
      </p>
      <div className="filter-chips" role="radiogroup" aria-label="Mostrar">
        {(
          [
            ['todas', 'Todas'],
            ['semente', 'Sementes'],
            ['misterio', 'Mistérios'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>

      {universe.seeds.length === 0 ? (
        <Empty icon={<Sprout size={32} />} title="Nenhuma trama ainda.">
          <p>Anote o que você está plantando: uma arma na parede, uma frase que vai voltar, uma pergunta sem resposta.</p>
        </Empty>
      ) : (
        <div className="board">
          {SEED_STATUSES.map((status) => {
            const col = seeds.filter((s) => s.status === status)
            return (
              <section
                key={status}
                className={`board-col seed-col-${status}`}
                aria-label={SEED_STATUS_LABEL[status]}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/seed')
                  if (id) move(id, status)
                }}
              >
                <h2 className="board-title">
                  {SEED_STATUS_LABEL[status]} <span className="muted">{col.length}</span>
                </h2>
                {col.map((s) => (
                  <article
                    key={s.id}
                    className="seed-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/seed', s.id)}
                  >
                    <button type="button" className="seed-card-open" onClick={() => setOpen(s.id)}>
                      <span className="seed-kind">
                        {s.kind === 'misterio' ? <HelpCircle size={13} aria-hidden="true" /> : <Sprout size={13} aria-hidden="true" />}
                        {s.kind === 'misterio' ? 'Mistério' : 'Semente'}
                      </span>
                      <span className="seed-title">{s.title}</span>
                      {s.description && <span className="seed-desc">{s.description}</span>}
                      {s.entityIds.length > 0 && <span className="seed-who">{s.entityIds.map((id) => entityName(universe, id)).join(', ')}</span>}
                      {s.kind === 'misterio' && s.clues.length > 0 && <span className="muted tiny">{s.clues.length} pistas</span>}
                    </button>
                    <label className="sr-only" htmlFor={`st-${s.id}`}>
                      Estado de {s.title}
                    </label>
                    <Select<SeedStatus>
                      id={`st-${s.id}`}
                      value={s.status}
                      onChange={(v) => move(s.id, v)}
                      options={SEED_STATUSES.map((x) => ({ value: x, label: SEED_STATUS_LABEL[x] }))}
                    />
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}

      {opened && <SeedDialog seed={opened} onClose={() => setOpen(null)} />}
    </div>
  )
}

function SeedDialog({ seed: s, onClose }: { seed: Seed; onClose: () => void }) {
  const { universe, update, go, undoable } = useWorkspace()
  const [clue, setClue] = useState('')
  const set = (c: Partial<Seed>) => update((u) => patch(u, 'seeds', s.id, c))
  const scenes = manuscriptOrder(universe)
  const sceneOptions = [{ value: '', label: '—' }, ...scenes.map((x) => ({ value: x.id, label: x.title || 'Sem título' }))]

  return (
    <Modal
      title={s.kind === 'misterio' ? 'Mistério' : 'Semente'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <ConfirmButton
            question="Apagar esta trama?"
            confirmLabel="Apagar"
            onConfirm={() => {
              undoable('Trama apagada', (u) => remove(u, 'seeds', s.id))
              onClose()
            }}
          >
            <Trash2 size={15} /> Apagar
          </ConfirmButton>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Pronto
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Título" wide>
          {(id) => <input id={id} className="input" value={s.title} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
        <Field label="Tipo">
          {(id) => (
            <Select
              id={id}
              value={s.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: 'semente', label: 'Semente' },
                { value: 'misterio', label: 'Mistério' },
              ]}
            />
          )}
        </Field>
        <Field label="Estado">
          {(id) => <Select<SeedStatus> id={id} value={s.status} onChange={(v) => set({ status: v })} options={SEED_STATUSES.map((x) => ({ value: x, label: SEED_STATUS_LABEL[x] }))} />}
        </Field>
        <Field label="Preparada em">
          {(id) => <Select id={id} value={s.setupSceneId ?? ''} onChange={(v) => set({ setupSceneId: v || null })} options={sceneOptions} />}
        </Field>
        <Field label="Paga em">
          {(id) => <Select id={id} value={s.payoffSceneId ?? ''} onChange={(v) => set({ payoffSceneId: v || null })} options={sceneOptions} />}
        </Field>
        <Field label="Descrição" wide>
          {(id) => <textarea id={id} className="input textarea" rows={3} value={s.description} onChange={(e) => set({ description: e.target.value })} />}
        </Field>
        <div className="field-wide">
          <EntityMultiPicker label="Envolve" value={s.entityIds} onChange={(ids) => set({ entityIds: ids })} />
        </div>
      </div>

      {(s.setupSceneId || s.payoffSceneId) && (
        <p className="small">
          {s.setupSceneId && (
            <button type="button" className="link-btn" onClick={() => go('escrever', s.setupSceneId)}>
              Ir para a preparação
            </button>
          )}
          {s.setupSceneId && s.payoffSceneId && ' · '}
          {s.payoffSceneId && (
            <button type="button" className="link-btn" onClick={() => go('escrever', s.payoffSceneId)}>
              Ir para o pagamento
            </button>
          )}
        </p>
      )}

      <h3 className="section-title">Pistas</h3>
      <ul className="clues">
        {s.clues.map((c) => (
          <li key={c.id} className="clue">
            <input className="input input-sm" aria-label="Pista" value={c.text} onChange={(e) => set({ clues: s.clues.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
            <Select
              label="Cena da pista"
              value={c.sceneId ?? ''}
              onChange={(v) => set({ clues: s.clues.map((x) => (x.id === c.id ? { ...x, sceneId: v || null } : x)) })}
              options={sceneOptions}
            />
            <button type="button" className="btn-icon btn-sm" aria-label="Remover pista" onClick={() => set({ clues: s.clues.filter((x) => x.id !== c.id) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          if (!clue.trim()) return
          set({ clues: [...s.clues, { id: newId(), text: clue.trim(), sceneId: null }] })
          setClue('')
        }}
      >
        <label htmlFor="nova-pista" className="sr-only">
          Nova pista
        </label>
        <input id="nova-pista" className="input input-sm" placeholder="Nova pista…" value={clue} onChange={(e) => setClue(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-ghost">
          <Plus size={14} /> Pista
        </button>
      </form>
    </Modal>
  )
}
