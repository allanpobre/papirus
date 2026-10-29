import { Plus, Skull, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Monster } from '../../model/schema'
import { insert, newId, patch, remove } from '../../model/universe'
import { draftMonster, sortedMonsters } from '../../rpg/bestiary'
import { defenseLabel } from '../../rpg/sheets'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { Modal } from '../../ui/Modal'
import { useRpg } from './rpgContext'

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
const num = (v: string) => (v.trim() === '' || v === '-' ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)

/** "PV 7 · CA 12 · Cimitarra +4 (1d6+2)". */
export function monsterLine(m: Monster, defLabel: string): string {
  return [`PV ${m.hp}`, m.defense !== null ? `${defLabel} ${m.defense}` : '', ...m.attacks.map((a) => `${a.name} ${signed(a.bonus)}${a.damage ? ` (${a.damage})` : ''}`)].filter(Boolean).join(' · ')
}

/** Um inimigo pronto: nome, vida, Defesa, iniciativa, ataques e notas. Tudo salva na hora. */
export function MonsterEditor({ monster: m }: { monster: Monster }) {
  const { update, undoable, readOnly } = useWorkspace()
  const { system } = useRpg()
  const defLabel = defenseLabel(system)
  const set = (c: Partial<Monster>) => update((u) => patch(u, 'monsters', m.id, c))
  const setAttack = (id: string, c: Partial<Monster['attacks'][number]>) => set({ attacks: m.attacks.map((a) => (a.id === id ? { ...a, ...c } : a)) })
  const field = `monstro-${m.id}`

  return (
    <div className="monster-editor">
      <div className="monster-grid">
        <label className="field">
          <span className="field-label">Nome</span>
          <input id={`${field}-nome`} className="input input-sm" value={m.name} readOnly={readOnly} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">PV</span>
          <input className="input input-sm" inputMode="numeric" value={m.hp} readOnly={readOnly} onChange={(e) => set({ hp: Math.max(1, num(e.target.value) ?? 1) })} />
        </label>
        <label className="field">
          <span className="field-label">{defLabel}</span>
          <input className="input input-sm" inputMode="numeric" value={m.defense ?? ''} readOnly={readOnly} onChange={(e) => set({ defense: num(e.target.value) })} />
        </label>
        <label className="field">
          <span className="field-label">Iniciativa</span>
          <input className="input input-sm" aria-label="Bônus de iniciativa" title="Bônus somado ao d20 da iniciativa" inputMode="numeric" value={m.initiative} readOnly={readOnly} onChange={(e) => set({ initiative: num(e.target.value) ?? 0 })} />
        </label>
      </div>
      <h4 className="section-label">Ataques</h4>
      {m.attacks.length === 0 && <p className="muted small">Sem ataques: na vez dele, o ataque rápido pede bônus e dano.</p>}
      <ul className="monster-attacks">
        {m.attacks.map((a) => (
          <li key={a.id} className="monster-attack">
            <input className="input input-sm" aria-label="Nome do ataque" value={a.name} readOnly={readOnly} onChange={(e) => setAttack(a.id, { name: e.target.value })} />
            <input className="input input-sm" aria-label={`Bônus de ${a.name || 'ataque'}`} inputMode="numeric" value={a.bonus} readOnly={readOnly} onChange={(e) => setAttack(a.id, { bonus: num(e.target.value) ?? 0 })} />
            <input className="input input-sm" aria-label={`Dano de ${a.name || 'ataque'}`} placeholder="1d6+2" spellCheck={false} value={a.damage} readOnly={readOnly} onChange={(e) => setAttack(a.id, { damage: e.target.value.replace(/\s+/g, '') })} />
            <input className="input input-sm" aria-label={`Crítico de ${a.name || 'ataque'}`} placeholder="19/x2" spellCheck={false} value={a.critical} readOnly={readOnly} onChange={(e) => setAttack(a.id, { critical: e.target.value })} />
            {!readOnly && (
              <button type="button" className="btn-icon btn-xs" aria-label={`Tirar ${a.name || 'ataque'}`} onClick={() => set({ attacks: m.attacks.filter((x) => x.id !== a.id) })}>
                <X size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ attacks: [...m.attacks, { id: newId(), name: m.attacks.length ? '' : 'Ataque', bonus: 0, damage: '', critical: '' }] })}>
          <Plus size={14} /> Ataque
        </button>
      )}
      <label className="field">
        <span className="field-label">Notas</span>
        <textarea className="input textarea" rows={2} placeholder="Táticas, fraquezas, o que ele carrega…" value={m.notes} readOnly={readOnly} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      {!readOnly && (
        <ConfirmButton className="btn btn-ghost btn-sm" question={`Apagar ${m.name || 'este inimigo'}?`} confirmLabel="Apagar" onConfirm={() => undoable('Inimigo apagado', (u) => remove(u, 'monsters', m.id))}>
          <Trash2 size={14} /> Apagar do bestiário
        </ConfirmButton>
      )}
    </div>
  )
}

/** Criar (ou acertar) um inimigo pronto sem sair do combate. */
export function MonsterDialog({ monsterId, onClose }: { monsterId: string; onClose: () => void }) {
  const { universe } = useWorkspace()
  const monster = universe.monsters.find((m) => m.id === monsterId)
  return (
    <Modal
      title="Inimigo pronto"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Pronto
        </button>
      }
    >
      <p className="muted small">Fica no bestiário (em Dados e tabelas) para usar em qualquer combate, quantas vezes precisar.</p>
      {monster ? <MonsterEditor monster={monster} /> : <p className="muted small">Este inimigo foi apagado.</p>}
    </Modal>
  )
}

/** O bestiário da campanha: os inimigos prontos, para entrar no combate com um toque. */
export function Bestiary() {
  const { universe, update, readOnly } = useWorkspace()
  const { system } = useRpg()
  const [open, setOpen] = useState<string | null>(null)
  const monsters = sortedMonsters(universe)
  const defLabel = defenseLabel(system)

  return (
    <section className="bestiary" aria-labelledby="bestiario-titulo">
      <h2 id="bestiario-titulo" className="section-title">
        <Skull size={17} aria-hidden="true" /> Inimigos prontos
      </h2>
      <p className="muted small">Vida, {defLabel} e ataques de cada inimigo. No combate, “3 goblins” entram na iniciativa numerados, com os ataques a um toque.</p>
      {!readOnly && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            let id = ''
            update((u) => {
              const [next, m] = insert(u, 'monsters', draftMonster('Novo inimigo'))
              id = m.id
              return next
            })
            setOpen(id)
          }}
        >
          <Plus size={14} /> Novo inimigo
        </button>
      )}
      {monsters.length === 0 ? (
        <p className="muted small">Nenhum inimigo pronto ainda.</p>
      ) : (
        <ul className="bestiary-list">
          {monsters.map((m) => (
            <li key={m.id} className="bestiary-item">
              <button type="button" className="bestiary-row" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
                <strong>{m.name || 'Sem nome'}</strong>
                <span className="muted small">{monsterLine(m, defLabel)}</span>
              </button>
              {open === m.id && <MonsterEditor monster={m} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
