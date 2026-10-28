import { CalendarDays, Crown, Dices, Eye, Feather, Settings2, Swords, Users, X, type LucideIcon } from 'lucide-react'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '../../styles/mesa.css'
import { tabListKeys } from '../../ui/keys'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { draftGroup, insert, newId, patch } from '../../model/universe'
import { describeOutcome, type RollOutcome } from '../../rpg/rolls'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { Empty } from '../../ui/bits'
import { CodexTab } from './CodexTab'
import { DiceTab } from './DiceTab'
import { GmTab } from './GmTab'
import { RpgContext, type RpgState } from './rpgContext'
import { SessionsTab } from './SessionsTab'
import { SheetsTab } from './SheetsTab'
import { SystemsTab } from './SystemsTab'
import { TableTab } from './TableTab'

export type RpgTab = 'mesa' | 'mestre' | 'sessoes' | 'personagens' | 'sistemas' | 'codex' | 'dados'

const TABS: [RpgTab, string, LucideIcon][] = [
  ['mestre', 'Painel do mestre', Crown],
  ['mesa', 'Na mesa', Swords],
  ['sessoes', 'Sessões', CalendarDays],
  ['personagens', 'Personagens', Users],
  ['codex', 'Revelações e Codex', Eye],
  ['dados', 'Dados e tabelas', Dices],
  ['sistemas', 'Sistemas', Settings2],
]

/** Entrar na mesa: o app inteiro muda de clima (cores, letras), como outro setor da casa. */
function useSector() {
  useEffect(() => {
    document.body.dataset.sector = 'mesa'
    return () => {
      delete document.body.dataset.sector
    }
  }, [])
}

/** A porta da mesa: abre ao entrar vindo de outra tela (não ao reabrir o app, nem para quem prefere menos movimento). */
function Gate({ name }: { name: string }) {
  const [show, setShow] = useState(() => performance.now() > 2500 && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 1300)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="mesa-gate" aria-hidden="true">
      <span className="mesa-gate-door mesa-gate-left" />
      <span className="mesa-gate-door mesa-gate-right" />
      <span className="mesa-gate-sign">
        <span className="mesa-gate-emblem">
          <Dices size={34} />
        </span>
        <span className="mesa-gate-title">Mesa de RPG</span>
        <span className="mesa-gate-sub">{name}</span>
      </span>
    </div>
  )
}

interface TrayRoll {
  id: string
  outcome: RollOutcome
  who?: string
  logged: boolean
}

export default function RpgView() {
  const { universe, update, nav, go } = useWorkspace()
  useSector()
  const [tab, setTab] = useState<RpgTab>(() => (nav.view === 'rpg' && nav.id ? 'sessoes' : ((recall('rpg-aba') as RpgTab) || 'mestre')))
  const [groupId, setGroupId] = useState<string | null>(() => recall(`rpg-grupo:${universe.id}`) ?? universe.groups[0]?.id ?? null)
  const [groupName, setGroupName] = useState('')
  const [tray, setTray] = useState<TrayRoll[]>([])
  const group = universe.groups.find((g) => g.id === groupId) ?? universe.groups[0]
  const system = group?.systemId ? universe.systems.find((s) => s.id === group.systemId) : undefined
  const activeSession = group ? universe.sessions.find((s) => s.groupId === group.id && s.status === 'em-andamento') : undefined

  const choose = (t: RpgTab) => {
    setTab(t)
    remember('rpg-aba', t)
  }

  const logText = useCallback(
    (text: string, kind: 'nota' | 'rolagem' = 'nota') => {
      if (!activeSession) return false
      const at = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      update((u) => {
        const s = u.sessions.find((x) => x.id === activeSession.id)
        return s ? patch(u, 'sessions', s.id, { log: [...s.log, { id: newId(), at, text, kind }] }) : u
      })
      return true
    },
    [activeSession, update],
  )

  const report = useCallback(
    (outcome: RollOutcome, who?: string) => {
      const shouldLog = system ? system.features.rollLog : true
      const logged = shouldLog ? logText(describeOutcome(outcome, who), 'rolagem') : false
      setTray((t) => [{ id: newId(), outcome, who, logged }, ...t].slice(0, 4))
    },
    [system, logText],
  )

  const ctx: RpgState | null = useMemo(
    () => (group ? { group, system, activeSession, report, logText } : null),
    [group, system, activeSession, report, logText],
  )

  return (
    <div className={`view rpg-view${tab === 'mesa' ? ' rpg-at-table' : ''}`}>
      <Gate name={universe.name || 'Sem nome'} />
      <header className="mesa-hero">
        <span className="mesa-emblem" aria-hidden="true">
          <Dices size={26} />
        </span>
        <div className="mesa-hero-text">
          <p className="mesa-kicker">{universe.name || 'Sem nome'} · setor da mesa</p>
          <h1>Mesa de RPG</h1>
          {universe.groups.length > 0 && (
            <div className="mesa-hero-meta">
              <label className="inline-label">
                <Users size={15} aria-hidden="true" />
                <span className="sr-only">Mesa</span>
                <select
                  className="input select input-sm"
                  value={group?.id ?? ''}
                  onChange={(e) => {
                    setGroupId(e.target.value)
                    remember(`rpg-grupo:${universe.id}`, e.target.value)
                  }}
                >
                  {universe.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="mesa-system">{system ? system.name : 'sem sistema'}</span>
              {activeSession && (
                <span className="mesa-live" role="status">
                  <span className="mesa-live-dot" aria-hidden="true" /> Sessão em andamento: {activeSession.title || 'sem título'}
                </span>
              )}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm mesa-exit" onClick={() => go('inicio')}>
          <Feather size={15} /> Voltar à escrita
        </button>
      </header>
      <div className="tabs mesa-tabs" role="tablist" onKeyDown={tabListKeys} aria-label="Mesa de RPG">
        {TABS.map(([t, label, Icon]) => (
          <button key={t} type="button" role="tab" className="tab mesa-tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => choose(t)}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'sistemas' ? (
        <SystemsTab />
      ) : !group || !ctx ? (
        tab === 'dados' ? (
          <DiceTab />
        ) : (
          <Empty icon={<Dices size={32} />} title="Use o mesmo mundo como campanha.">
            <p>Crie uma mesa (grupo de jogadores) para registrar sessões, fichas e o que cada mesa já descobriu.</p>
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
                Nome da mesa
              </label>
              <input id="novo-grupo" className="input" placeholder="Mesa de sexta" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <button type="submit" className="btn btn-primary">
                Criar mesa
              </button>
            </form>
          </Empty>
        )
      ) : (
        <RpgContext.Provider value={ctx}>
          {tab === 'mestre' && <GmTab onGo={choose} />}
          {tab === 'mesa' && <TableTab />}
          {tab === 'sessoes' && <SessionsTab />}
          {tab === 'personagens' && <SheetsTab />}
          {tab === 'codex' && <CodexTab group={group} />}
          {tab === 'dados' && <DiceTab />}
        </RpgContext.Provider>
      )}

      {tray.length > 0 && (
        <aside className="dice-tray" aria-label="Últimas rolagens" aria-live="polite">
          {tray.map((r, i) => (
            <div key={r.id} className={`tray-roll tone-${r.outcome.tone}${i === 0 ? ' tray-latest' : ''}`}>
              <span className="tray-total tabular">{r.outcome.result.total}</span>
              <span className="tray-body">
                <span className="tray-label">
                  {r.who ? `${r.who} · ` : ''}
                  {r.outcome.label}
                </span>
                <span className="tray-detail">
                  {r.outcome.verdict && <strong>{r.outcome.verdict} · </strong>}
                  {r.outcome.expression} {r.outcome.result.parts.filter((p) => p.rolls.length).map((p) => `[${p.rolls.join(', ')}]`).join(' ')}
                  {r.logged && ' · no registro'}
                </span>
              </span>
            </div>
          ))}
          <button type="button" className="btn-icon btn-sm tray-close" aria-label="Limpar rolagens" onClick={() => setTray([])}>
            <X size={14} />
          </button>
        </aside>
      )}
    </div>
  )
}
