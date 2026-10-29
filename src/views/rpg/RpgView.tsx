import { ArrowLeft, CalendarDays, Crown, Dices, Eye, Palette, Settings2, Swords, Users, X, type LucideIcon } from 'lucide-react'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '../../styles/mesa.css'
import { tabListKeys } from '../../ui/keys'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MesaGate } from './MesaGate'
import { draftGroup, insert, newId, patch } from '../../model/universe'
import { applyDamage, lifeOf } from '../../rpg/combat'
import { critDamage, damageAfter, describeOutcome, landed, type RollOutcome } from '../../rpg/rolls'
import { onIncomingRoll } from '../../share/useTableRolls'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { Empty } from '../../ui/bits'
import { Modal } from '../../ui/Modal'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { MESA_THEMES, mesaTheme, NO_THEME, suggestedTheme } from '../../rpg/themes'
import { useMesaSector } from '../../rpg/useMesaSector'
import { PhysicalRollDialog } from './PhysicalRollDialog'
import { InviteDialog, LiveSessionPill, MesaPresence, SessionClosing, SessionOpening } from './LiveTable'
import { beginSession, finishSession, sessionToStart } from '../../rpg/sessionLife'
import { makeSystem } from '../../rpg/systems'

const FALLBACK = makeSystem('narrativo')
import { CodexTab } from './CodexTab'
import { DiceTab } from './DiceTab'
import { GmTab } from './GmTab'
import { RpgContext, type RpgState } from './rpgContext'
import { SessionsTab } from './SessionsTab'
import { SheetsTab } from './SheetsTab'
import { SystemsTab } from './SystemsTab'
import { TableTab } from './TableTab'
import { PageHelp } from '../../ui/PageTour'

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

/** O mestre escolhe o tema da mesa pelo gênero do jogo. */
function ThemePicker({ value, suggested, onChange, onClose, dark }: { value: string | null; suggested: string; onChange: (id: string | null) => void; onClose: () => void; dark: boolean }) {
  const current = value ?? suggested
  return (
    <Modal title="Tema da mesa" onClose={onClose}>
      <p className="muted small">Cada mesa tem o seu clima. Quem joga (aqui e no Codex) só escolhe claro ou escuro.</p>
      <ul className="mesa-themes" role="radiogroup" aria-label="Tema da mesa">
        {MESA_THEMES.map((t) => {
          const [bg, card, accent] = dark ? t.dark : t.light
          return (
            <li key={t.id}>
              <button type="button" role="radio" aria-checked={current === t.id} className="mesa-theme" onClick={() => onChange(t.id)}>
                <span className="mesa-theme-swatch" style={{ background: bg }} aria-hidden="true">
                  <span style={{ background: card }} />
                  <span style={{ background: accent }} />
                </span>
                <span className="mesa-theme-name">
                  {t.name}
                  {t.id === suggested && value === null && <span className="muted tiny"> · sugerido</span>}
                </span>
                <span className="muted small">{t.genre}</span>
              </button>
            </li>
          )
        })}
        <li>
          <button type="button" role="radio" aria-checked={current === NO_THEME} className="mesa-theme" onClick={() => onChange(NO_THEME)}>
            <span className="mesa-theme-swatch mesa-theme-none" aria-hidden="true" />
            <span className="mesa-theme-name">Sem tema</span>
            <span className="muted small">As cores de sempre do app</span>
          </button>
        </li>
      </ul>
    </Modal>
  )
}

interface TrayRoll {
  id: string
  outcome: RollOutcome
  who?: string
  logged: boolean
  /** Como ficou o alvo depois que o dano saiu da vida dele. */
  applied?: string
  /** Rolada no celular do jogador, pelo Codex. */
  remote?: boolean
  /** O dano deste ataque já foi rolado. */
  followed?: boolean
}

export default function RpgView() {
  const { universe, update, nav, go, prefs, readOnly, kind, closeUniverse } = useWorkspace()
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = prefs.theme === 'escuro' || (prefs.theme === 'sistema' && systemDark)
  const [picking, setPicking] = useState(false)
  const [tab, setTab] = useState<RpgTab>(() => (nav.view === 'rpg' && nav.id ? 'sessoes' : ((recall('rpg-aba') as RpgTab) || 'mestre')))
  const [groupId, setGroupId] = useState<string | null>(() => recall(`rpg-grupo:${universe.id}`) ?? universe.groups[0]?.id ?? null)
  const [groupName, setGroupName] = useState('')
  const [tray, setTray] = useState<TrayRoll[]>([])
  const group = universe.groups.find((g) => g.id === groupId) ?? universe.groups[0]
  const system = group?.systemId ? universe.systems.find((s) => s.id === group.systemId) : undefined
  const activeSession = group ? universe.sessions.find((s) => s.groupId === group.id && s.status === 'em-andamento') : undefined
  const theme = mesaTheme(group?.theme, system?.name)
  useMesaSector(theme, dark)

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

  const show = useCallback(
    (outcome: RollOutcome, who?: string) => {
      const shouldLog = system ? system.features.rollLog : true
      const logged = shouldLog ? logText(describeOutcome(outcome, who), 'rolagem') : false
      setTray((t) => [{ id: newId(), outcome, who, logged }, ...t].slice(0, 4))
    },
    [system, logText],
  )
  // Dados na mesa (físicos) ou no app: com dados físicos, cada rolagem pergunta o que saiu.
  const [physical, setPhysical] = useState(() => recall('rpg-dados') !== 'app')
  const [asking, setAsking] = useState<{ outcome: RollOutcome; who?: string } | null>(null)
  const report = useCallback(
    (outcome: RollOutcome, who?: string) => {
      if (physical) setAsking({ outcome, who })
      else show(outcome, who)
    },
    [physical, show],
  )

  // Rolagens dos jogadores pelo Codex: já estão no registro; aqui só aparecem na bandeja.
  const groupKey = group?.id
  useEffect(
    () =>
      onIncomingRoll((r) => {
        if (r.groupId === groupKey) setTray((t) => [{ id: newId(), outcome: r.outcome, who: r.who, logged: r.logged, remote: true }, ...t].slice(0, 4))
      }),
    [groupKey],
  )

  // Dano de um ataque mirado: sai da vida do alvo (da ficha, ou do PV anotado na iniciativa).
  const hurt = (r: TrayRoll) => {
    const target = r.outcome.combat?.target
    if (!activeSession || !target) return
    const amount = r.outcome.result.total
    const done = applyDamage(universe, activeSession.id, target.id, amount)
    if (!done) return
    update((u) => applyDamage(u, activeSession.id, target.id, amount)?.universe ?? u)
    const now = `${done.current}${done.max !== null ? `/${done.max}` : ''}`
    logText(`${done.name} perde ${amount} ${done.abbr} (fica com ${now})${done.down ? ' · derrotado' : ''}`)
    setTray((t) => t.map((x) => (x.id === r.id ? { ...x, applied: `${done.name}: ${done.abbr} ${now}${done.down ? ' · derrotado' : ''}` } : x)))
  }

  // A sessão como evento: a abertura em tela cheia ao começar, o resumo ao terminar.
  const [opening, setOpening] = useState<string | null>(null)
  const [closing, setClosing] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const startSession = useCallback(
    (id?: string) => {
      if (!group) return
      let started = ''
      update((u) => {
        const [next, sid] = beginSession(u, group.id, id ?? sessionToStart(u, group.id).id)
        started = sid
        return next
      })
      setTab('mesa')
      remember('rpg-aba', 'mesa')
      setOpening(started)
    },
    [group, update],
  )
  const endSession = useCallback(
    (id: string) => {
      if (!group) return
      update((u) => finishSession(u, id, group.name).universe)
      setClosing(id)
    },
    [group, update],
  )
  const invite = useCallback(() => setInviting(true), [])

  const ctx: RpgState | null = useMemo(
    () => (group ? { group, system, activeSession, report, logText, startSession, endSession, invite } : null),
    [group, system, activeSession, report, logText, startSession, endSession, invite],
  )
  const opened = opening ? universe.sessions.find((s) => s.id === opening) : undefined
  const openedGroup = opened && universe.groups.find((g) => g.id === opened.groupId)
  const before = opened && universe.sessions.filter((s) => s.groupId === opened.groupId && s.status === 'encerrada' && s.number < opened.number).sort((a, b) => b.number - a.number)[0]
  const closed = closing ? universe.sessions.find((s) => s.id === closing) : undefined
  const closedGroup = closed && universe.groups.find((g) => g.id === closed.groupId)

  return (
    <div className={`view rpg-view${tab === 'mesa' ? ' rpg-at-table' : ''}`}>
      {/* Numa campanha, a porta abre na entrada do universo (área de trabalho). */}
      {kind !== 'campanha' && <MesaGate name={universe.name || 'Sem nome'} />}
      <header className="mesa-hero">
        <span className="mesa-emblem" aria-hidden="true">
          <Dices size={26} />
        </span>
        <div className="mesa-hero-text">
          {/* A saída, sempre à vista: de uma campanha para o início do Papirus; de um livro, para a escrita. */}
          {kind === 'campanha' ? (
            <button type="button" className="mesa-back" onClick={() => closeUniverse()}>
              <ArrowLeft size={15} aria-hidden="true" /> Campanhas
            </button>
          ) : (
            <button type="button" className="mesa-back" onClick={() => go('inicio')}>
              <ArrowLeft size={15} aria-hidden="true" /> Voltar à escrita
            </button>
          )}
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
              {activeSession && <LiveSessionPill session={activeSession} />}
              {group && !readOnly && <MesaPresence group={group} onInvite={invite} />}
            </div>
          )}
        </div>
        <div className="mesa-actions">
          <PageHelp tour={`rpg-${tab}`} />
          <div className="mesa-dice-mode" role="radiogroup" aria-label="Dados">
            <span className="mesa-dice-label">Dados</span>
            {(
              [
                [true, 'Na mesa'],
                [false, 'No app'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={physical === v}
                title={v ? 'Você rola os dados de verdade e diz o que saiu; o app faz a conta' : 'O app sorteia'}
                onClick={() => {
                  setPhysical(v)
                  remember('rpg-dados', v ? 'fisico' : 'app')
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {group && !readOnly && (
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Tema da mesa" title="Tema da mesa" onClick={() => setPicking(true)}>
              <Palette size={15} /> <span className="mesa-act-label">Tema</span>
            </button>
          )}
        </div>
        {picking && group && (
          <ThemePicker
            value={group.theme}
            suggested={suggestedTheme(system?.name)}
            dark={dark}
            onClose={() => setPicking(false)}
            onChange={(id) => update((u) => patch(u, 'groups', group.id, { theme: id }))}
          />
        )}
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

      {inviting && group && <InviteDialog group={group} onClose={() => setInviting(false)} />}
      {opened && openedGroup && <SessionOpening group={openedGroup} session={opened} previous={before} onClose={() => setOpening(null)} />}
      {closed && closedGroup && <SessionClosing group={closedGroup} session={closed} onClose={() => setClosing(null)} />}

      {asking && (
        <PhysicalRollDialog
          system={system ?? FALLBACK}
          outcome={asking.outcome}
          who={asking.who}
          onClose={() => setAsking(null)}
          onDone={(o) => {
            setAsking(null)
            show(o, asking.who)
          }}
          onDigital={() => {
            setAsking(null)
            show(asking.outcome, asking.who)
          }}
        />
      )}
      {tray.length > 0 && (
        <aside className="dice-tray" aria-label="Últimas rolagens" aria-live="polite">
          {tray.map((r, i) => {
            const c = r.outcome.combat
            const entry = c && activeSession?.initiative.find((e) => e.id === c.target.id)
            const life = entry ? lifeOf(universe, entry) : null
            const canHurt = c?.hurts && !r.applied && r.outcome.result.total > 0
            const crit = r.outcome.tone === 'critico'
            return (
              <div key={r.id} className={`tray-roll tone-${r.outcome.tone}${i === 0 ? ' tray-latest' : ''}`}>
                <span className="tray-total tabular">{r.outcome.result.total}</span>
                <span className="tray-body">
                  <span className="tray-label">
                    {r.who ? `${r.who} · ` : ''}
                    {r.outcome.label}
                  </span>
                  <span className="tray-detail">
                    {r.outcome.verdict && <strong>{r.outcome.verdict} · </strong>}
                    {c && !c.hurts && c.target.defense !== null && `${c.target.defenseLabel} ${c.target.defense} · `}
                    {r.outcome.expression} {r.outcome.result.parts.filter((p) => p.rolls.length).map((p) => `[${p.rolls.join(', ')}]`).join(' ')}
                    {r.remote && ' · pelo Codex'}
                    {r.logged && ' · no registro'}
                  </span>
                  {c && !r.followed && landed(r.outcome) && c.damage?.expression.trim() && (
                    <button
                      type="button"
                      className="btn btn-sm tray-act"
                      onClick={() => {
                        const next = damageAfter(system ?? FALLBACK, r.outcome)
                        if (!next) return
                        setTray((t) => t.map((x) => (x.id === r.id ? { ...x, followed: true } : x)))
                        report(next, r.who)
                      }}
                    >
                      Rolar dano{crit ? ' crítico' : ''} ({crit ? critDamage(c.damage.expression, c.damage.mult) : c.damage.expression})
                    </button>
                  )}
                  {canHurt &&
                    (life ? (
                      <button type="button" className="btn btn-sm tray-act" onClick={() => hurt(r)}>
                        Tirar {r.outcome.result.total} {life.abbr} de {c.target.name}
                      </button>
                    ) : (
                      <span className="tray-note">Anote o PV de {c.target.name} na iniciativa para descontar.</span>
                    ))}
                  {r.applied && <span className="tray-note tray-applied">{r.applied}</span>}
                </span>
              </div>
            )
          })}
          <button type="button" className="btn-icon btn-sm tray-close" aria-label="Limpar rolagens" onClick={() => setTray([])}>
            <X size={14} />
          </button>
        </aside>
      )}
    </div>
  )
}
