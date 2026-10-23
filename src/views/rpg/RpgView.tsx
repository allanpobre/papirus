import { Dices, Users } from 'lucide-react'
import { useState } from 'react'
import { draftGroup, insert } from '../../model/universe'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { Empty } from '../../ui/bits'
import { CodexTab } from './CodexTab'
import { DiceTab } from './DiceTab'
import { GmTab } from './GmTab'
import { SessionsTab } from './SessionsTab'

type Tab = 'mestre' | 'sessoes' | 'codex' | 'dados'

export default function RpgView() {
  const { universe, update, nav } = useWorkspace()
  const [tab, setTab] = useState<Tab>(() => (nav.view === 'rpg' && nav.id ? 'sessoes' : ((recall('rpg-aba') as Tab) || 'mestre')))
  const [groupId, setGroupId] = useState<string | null>(() => universe.groups[0]?.id ?? null)
  const [groupName, setGroupName] = useState('')
  const group = universe.groups.find((g) => g.id === groupId) ?? universe.groups[0]

  const choose = (t: Tab) => {
    setTab(t)
    remember('rpg-aba', t)
  }

  return (
    <div className="view rpg-view">
      <header className="view-head view-head-wide">
        <h1>Mesa de RPG</h1>
        <div className="tabs tabs-inline" role="tablist">
          {(
            [
              ['mestre', 'Painel do mestre'],
              ['sessoes', 'Sessões'],
              ['codex', 'Revelações e Codex'],
              ['dados', 'Dados e iniciativa'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => choose(t)}>
              {label}
            </button>
          ))}
        </div>
        {universe.groups.length > 0 && (
          <label className="inline-label">
            <Users size={15} aria-hidden="true" />
            <span className="sr-only">Grupo</span>
            <select className="input select input-sm" value={group?.id ?? ''} onChange={(e) => setGroupId(e.target.value)}>
              {universe.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {tab === 'dados' ? (
        <DiceTab />
      ) : !group ? (
        <Empty icon={<Dices size={32} />} title="Use o mesmo mundo como campanha.">
          <p>Crie um grupo de jogadores para registrar sessões e controlar o que cada mesa já descobriu.</p>
          <form
            className="inline-fields"
            onSubmit={(e) => {
              e.preventDefault()
              let id = ''
              update((u) => {
                const [next, g] = insert(u, 'groups', draftGroup(groupName.trim() || 'Mesa principal'))
                id = g.id
                return next
              })
              setGroupId(id)
              setGroupName('')
            }}
          >
            <label htmlFor="novo-grupo" className="sr-only">
              Nome do grupo
            </label>
            <input id="novo-grupo" className="input" placeholder="Mesa de sexta" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <button type="submit" className="btn btn-primary">
              Criar grupo
            </button>
          </form>
        </Empty>
      ) : tab === 'mestre' ? (
        <GmTab group={group} onGo={choose} />
      ) : tab === 'sessoes' ? (
        <SessionsTab group={group} />
      ) : (
        <CodexTab group={group} />
      )}
    </div>
  )
}
