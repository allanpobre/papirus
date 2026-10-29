import { BookOpen, Dices, Flag, ListChecks, Maximize2, Megaphone, Minimize2, Palette, ScrollText, Swords, Users, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '../../model/schema'
import { patch } from '../../model/universe'
import { sessionName } from '../../rpg/sessionLife'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { Modal } from '../../ui/Modal'
import { MoreMenu } from '../../ui/MoreMenu'
import { PageHelp } from '../../ui/PageTour'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { AnnounceDialog } from './Announce'
import { InitiativeTracker } from './InitiativeTracker'
import { MesaPresence } from './LiveTable'
import { markMesaGate } from './MesaGate'
import { useRpg } from './rpgContext'
import { AskRollDialog, RequestsPanel } from './Requests'
import { SecretsPanel } from './Secrets'
import { SheetPlay } from './SheetPlay'
import { LogBox, PartyCards, QuickDice, TableRolls } from './TableTab'

type Part = 'combate' | 'grupo' | 'dados' | 'registro' | 'segredos'

const PARTS: [Part, string, LucideIcon][] = [
  ['combate', 'Combate', Swords],
  ['grupo', 'Grupo', Users],
  ['dados', 'Dados', Dices],
  ['registro', 'Registro', BookOpen],
  ['segredos', 'Segredos', ScrollText],
]

/** Tempo de jogo desde o começo: "1:25". */
function SessionClock({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(t)
  }, [])
  if (!startedAt) return null
  const min = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000))
  const clock = `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
  return (
    <span className="sm-clock" role="timer" title="Tempo de jogo" aria-label={`Tempo de jogo: ${Math.floor(min / 60)} h ${min % 60} min`}>
      <span className="mesa-live-dot" aria-hidden="true" />
      <span className="tabular" aria-hidden="true">
        {clock}
      </span>
    </span>
  )
}

/** A preparação da sessão (só o mestre vê), à mão durante o jogo. */
function Prep({ session }: { session: Session }) {
  const { update, readOnly } = useWorkspace()
  return (
    <details className="sm-prep" open={Boolean(session.prep.trim())}>
      <summary className="section-label">Preparação · só você vê</summary>
      <label htmlFor="sm-prep" className="sr-only">
        Preparação da sessão
      </label>
      <textarea
        id="sm-prep"
        className="input textarea"
        rows={4}
        readOnly={readOnly}
        placeholder="Ganchos, cenas possíveis, nomes de reserva…"
        value={session.prep}
        onChange={(e) => update((u) => patch(u, 'sessions', session.id, { prep: e.target.value }))}
      />
    </details>
  )
}

/**
 * O modo sessão: quando a sessão começa, o app vira a mesa. Some o menu da escrita; fica a barra
 * da sessão (o nome, o tempo, quem está, anunciar, dados, encerrar) e só o que se usa no jogo, em
 * colunas que rolam sozinhas. No celular, uma parte por vez, com as abas embaixo.
 */
export function SessionMode({ session, diceMode, onTheme, onLeave }: { session: Session; diceMode: ReactNode; onTheme: () => void; onLeave: () => void }) {
  const { universe, readOnly } = useWorkspace()
  const { group, endSession, invite } = useRpg()
  const phone = useMediaQuery('(max-width: 760px)')
  const wide = useMediaQuery('(min-width: 1181px)')
  const [part, setPart] = useState<Part>(() => (recall('sessao-parte') as Part) || 'combate')
  const [announcing, setAnnouncing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement))
  const name = sessionName(session.number, session.title)
  const sheet = sheetId ? universe.sheets.find((s) => s.id === sheetId) : undefined
  const sheetSystem = sheet ? universe.systems.find((x) => x.id === sheet.systemId) : undefined

  // Enquanto a sessão está na tela, o resto do app (o menu da escrita) sai de cena.
  useEffect(() => {
    markMesaGate()
    document.documentElement.classList.add('session-mode')
    return () => document.documentElement.classList.remove('session-mode')
  }, [])

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  const choose = (p: Part) => {
    setPart(p)
    remember('sessao-parte', p)
  }

  const panels: Record<Part, ReactNode> = {
    combate: (
      <div className="table-panel sm-panel sm-combate">
        <InitiativeTracker session={session} />
      </div>
    ),
    grupo: (
      <section className="table-panel sm-panel" aria-label="Grupo">
        <h2 className="section-title">Grupo</h2>
        <PartyCards onSheet={setSheetId} />
      </section>
    ),
    dados: (
      <section className="table-panel sm-panel" aria-label="Dados">
        <h2 className="section-title">Dados</h2>
        <QuickDice />
        <TableRolls />
      </section>
    ),
    registro: (
      <section className="table-panel sm-panel" aria-label="Registro">
        <h2 className="section-title">Registro</h2>
        <Prep session={session} />
        <LogBox />
      </section>
    ),
    segredos: <SecretsPanel />,
  }

  // Computador: combate | grupo e segredos | dados e registro. Tablet: duas colunas. Celular: uma parte por vez.
  const columns: Part[][] = phone ? [[part]] : wide ? [['combate'], ['grupo', 'segredos'], ['dados', 'registro']] : [['combate', 'grupo'], ['dados', 'registro', 'segredos']]

  return (
    <div className="session-mode-view">
      <header className="sm-bar">
        <span className="sm-emblem" aria-hidden="true">
          <Dices size={20} />
        </span>
        <div className="sm-title">
          <p className="sm-kicker">
            {group.name} · Sessão {session.number}
          </p>
          <h1 className="sm-name">{name ?? `Sessão ${session.number}`}</h1>
        </div>
        <SessionClock startedAt={session.startedAt} />
        {!readOnly && <MesaPresence group={group} onInvite={invite} />}
        <div className="sm-acts">
          {!readOnly && (
            <button type="button" className="btn btn-sm sm-ask" onClick={() => setAsking(true)}>
              <ListChecks size={15} /> Pedir teste
            </button>
          )}
          {!readOnly && (
            <button type="button" className="btn btn-primary btn-sm sm-announce" onClick={() => setAnnouncing(true)}>
              <Megaphone size={15} /> Anunciar
            </button>
          )}
          <PageHelp tour="sessao" />
          <MoreMenu label="Mais da sessão">
            {(close) => (
              <div className="sm-more">
                <div className="sm-more-dice">{diceMode}</div>
                {!readOnly && (
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      onTheme()
                    }}
                  >
                    <Palette size={16} /> Tema da mesa
                  </button>
                )}
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    close()
                    toggleFull()
                  }}
                >
                  {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {full ? 'Sair da tela cheia' : 'Tela cheia'}
                </button>
                <button
                  type="button"
                  className="more-menu-item sm-leave"
                  title="A sessão continua, e dá para voltar de qualquer lugar"
                  onClick={() => {
                    close()
                    onLeave()
                  }}
                >
                  <X size={16} /> Sair do modo sessão
                </button>
                {!readOnly && (
                  <ConfirmButton className="more-menu-item more-menu-danger sm-end" question="Encerrar a sessão?" confirmLabel="Encerrar" onConfirm={() => endSession(session.id)}>
                    <Flag size={16} /> Encerrar sessão
                  </ConfirmButton>
                )}
              </div>
            )}
          </MoreMenu>
        </div>
      </header>

      <RequestsPanel />
      <div className={`sm-body sm-cols-${columns.length}`}>
        {columns.map((col, i) => (
          <div key={i} className="sm-col">
            {col.map((p) => (
              <div key={p} className="sm-slot">
                {panels[p]}
              </div>
            ))}
          </div>
        ))}
      </div>

      {phone && (
        <nav className="sm-dock" aria-label="Partes da sessão">
          {PARTS.map(([p, label, Icon]) => (
            <button key={p} type="button" aria-current={part === p ? 'page' : undefined} onClick={() => choose(p)}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {announcing && <AnnounceDialog onClose={() => setAnnouncing(false)} />}
      {asking && <AskRollDialog onClose={() => setAsking(false)} />}
      {sheet && (
        <Modal title={`Ficha de ${sheet.name}`} side onClose={() => setSheetId(null)}>
          {sheetSystem ? <SheetPlay sheet={sheet} system={sheetSystem} /> : <p className="muted small">Esta ficha não tem sistema: escolha um em Personagens.</p>}
        </Modal>
      )}
    </div>
  )
}
