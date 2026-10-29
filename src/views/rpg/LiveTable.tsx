import qrcode from 'qrcode-generator'
import { BookOpen, Copy, Dices, ExternalLink, Flag, Inbox, Play, Radio, Send, Settings, UserCheck, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Group, Session } from '../../model/schema'
import { newId, patch } from '../../model/universe'
import { durationLabel, partyOf, playedLog, sessionName, sessionSummary } from '../../rpg/sessionLife'
import { useTablePresence } from '../../share/presence'
import { DEFAULT_PUBLIC_URL, deleteCodex, newShareKey, playerLink } from '../../share/server'
import { codexSnapshot } from '../../share/snapshot'
import { publishNow, serverFrom, useSyncState } from '../../share/useCodexSync'
import { useWorkspace } from '../../state/workspace'
import { Modal, trapFocus } from '../../ui/Modal'
import { useBackLayer } from '../../ui/useBackLayer'
import { RecapEditor } from './Journal'
import { AttendanceList } from './Attendance'

/** O link da mesa (Codex ao vivo): ligar, desligar, o endereço e o QR code. */
export function useMesaLink(group: Group) {
  const { universe, update, prefs, toast } = useWorkspace()
  const server = serverFrom(prefs)
  const sync = useSyncState(group.id)
  const [starting, setStarting] = useState(false)
  const share = group.share
  const link = share && server ? playerLink(prefs.publicUrl || DEFAULT_PUBLIC_URL, server, share.id) : ''

  const qr = useMemo(() => {
    if (!link) return ''
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [link])

  const start = async () => {
    if (!server) return false
    setStarting(true)
    const s = { id: newId(), key: newShareKey() }
    const ok = await publishNow(server, group.id, s, codexSnapshot(universe, group.id))
    setStarting(false)
    if (ok) update((u) => patch(u, 'groups', group.id, { share: s }))
    return ok
  }

  const stop = async () => {
    if (!share || !server) return
    try {
      await deleteCodex(server, share.id, share.key)
    } catch {
      // Mesmo sem conexão, a mesa deixa de publicar; o link antigo pode continuar mostrando a última versão.
      toast('Não foi possível apagar do servidor agora. O link para de atualizar.', { tone: 'erro' })
    }
    update((u) => patch(u, 'groups', group.id, { share: null }))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado')
    } catch {
      toast('Não deu para copiar. Selecione o link e copie.', { tone: 'erro' })
    }
  }

  return { server, share, link, qr, sync, starting, start, stop, copy }
}

/** Os jogadores com o Codex aberto agora, pelo personagem que escolheram. */
export function PresenceList({ groupId, empty }: { groupId: string; empty?: string }) {
  const people = useTablePresence(groupId)
  if (!people.length) return empty ? <p className="muted small presence-empty">{empty}</p> : null
  return (
    <ul className="presence" aria-label="Na mesa agora">
      {people.map((p, i) => (
        <li key={p.name ?? `alguem-${i}`} className={`presence-chip${p.name ? '' : ' is-unknown'}`}>
          <span className="presence-dot" aria-hidden="true" />
          {p.name ?? 'Alguém escolhendo o personagem'}
          {p.count > 1 && <span className="muted tiny"> ×{p.count}</span>}
        </li>
      ))}
    </ul>
  )
}

/** O que mostrar para convidar: o link e o QR, ou o caminho para ligar o Codex ao vivo. */
export function InvitePanel({ group, compact = false }: { group: Group; compact?: boolean }) {
  const { go } = useWorkspace()
  const m = useMesaLink(group)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  // O botão de criar some quando o link fica pronto: o foco passa para "Copiar o link".
  const copyButton = useRef<HTMLButtonElement>(null)
  const [created, setCreated] = useState(false)
  useEffect(() => {
    if (created && m.share) copyButton.current?.focus()
  }, [created, m.share])

  if (!m.server)
    return (
      <div className="invite">
        <p className="small">Os jogadores entram por um link no celular, sem conta. Para isso, o Papirus precisa de um servidor (Supabase, plano grátis), configurado uma vez.</p>
        <button type="button" className="btn btn-sm" onClick={() => go('config', 'conta')}>
          <Settings size={14} /> Configurar o servidor
        </button>
      </div>
    )

  if (!m.share)
    return (
      <div className="invite">
        <p className="small">Crie o link da mesa: cada jogador abre no celular, escolhe o personagem e acompanha a sessão ao vivo. Não precisa de conta.</p>
        <button type="button" className="btn btn-primary" disabled={m.starting} onClick={() => void m.start().then((ok) => ok && setCreated(true))}>
          <Radio size={15} /> {m.starting ? 'Criando o link…' : 'Criar o link da mesa'}
        </button>
        {m.sync?.state === 'erro' && (
          <p className="notice notice-error small" role="alert">
            {m.sync.error}
          </p>
        )}
      </div>
    )

  return (
    <div className={`invite is-on${compact ? ' is-compact' : ''}`}>
      <div className="invite-qr" role="img" aria-label="QR code do link para os jogadores" dangerouslySetInnerHTML={{ __html: m.qr }} />
      <div className="invite-side">
        <p className="small">Aponte a câmera do celular para o código, ou mande o link. Cada jogador escolhe o seu personagem.</p>
        <div className="share-link">
          <label htmlFor={`convite-${group.id}`} className="sr-only">
            Link para os jogadores
          </label>
          <input id={`convite-${group.id}`} className="input input-sm" readOnly value={m.link} onFocus={(e) => e.target.select()} />
        </div>
        <div className="inline-fields">
          <button ref={copyButton} type="button" className="btn btn-sm btn-primary" onClick={() => void m.copy()}>
            <Copy size={14} /> Copiar o link
          </button>
          {canShare && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void navigator.share({ title: `Mesa: ${group.name}`, text: `Entre na mesa “${group.name}” no Papirus:`, url: m.link }).catch(() => undefined)}
            >
              <Send size={14} /> Enviar
            </button>
          )}
          {!compact && (
            <a className="btn btn-sm btn-ghost" href={m.link} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir como jogador
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/** A janela de convite, aberta pelo botão "Convidar" do alto da mesa. */
export function InviteDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  return (
    <Modal title="Convidar jogadores" size="md" onClose={onClose} help="convidar">
      <InvitePanel group={group} />
      <section className="invite-who" aria-labelledby="convite-quem">
        <h3 id="convite-quem" className="section-label">
          <Users size={14} aria-hidden="true" /> Na mesa agora
        </h3>
        <PresenceList groupId={group.id} empty={group.share ? 'Ninguém entrou ainda. Quem abrir o link aparece aqui.' : 'Quando o link estiver criado, quem entrar aparece aqui.'} />
      </section>
    </Modal>
  )
}

/** No alto da mesa: quem está online e o botão de convidar, sempre à vista. */
export function MesaPresence({ group, onInvite }: { group: Group; onInvite: () => void }) {
  const people = useTablePresence(group.id)
  return (
    <div className="mesa-presence">
      {people.length > 0 && (
        <span className="mesa-presence-who">
          <Users size={14} aria-hidden="true" />
          <ul className="mesa-presence-list" aria-label="Na mesa agora">
            {people.slice(0, 4).map((p, i) => (
              <li key={p.name ?? `alguem-${i}`} className="mesa-presence-chip">
                <span className="presence-dot" aria-hidden="true" />
                {p.name ?? 'alguém'}
              </li>
            ))}
            {people.length > 4 && <li className="mesa-presence-more">e mais {people.length - 4}</li>}
          </ul>
        </span>
      )}
      <button type="button" className={`btn btn-sm mesa-invite${people.length ? ' btn-ghost' : ' btn-primary'}`} aria-label={people.length ? 'Convidar' : 'Convidar jogadores'} onClick={onInvite}>
        <UserPlus size={15} /> <span className="mesa-invite-label">{people.length ? 'Convidar' : 'Convidar jogadores'}</span>
      </button>
    </div>
  )
}

const ago = (iso: string | null, now: number) => {
  if (!iso) return ''
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** "Sessão 2 · A Torre · há 25 min", no alto da mesa enquanto a sessão está em andamento. */
export function LiveSessionPill({ session }: { session: Session }) {
  const name = sessionName(session.number, session.title)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="mesa-live" role="status">
      <span className="mesa-live-dot" aria-hidden="true" />
      <span>
        Sessão {session.number} ao vivo{name ? ` · ${name}` : ''}
        {session.startedAt && <span className="mesa-live-time"> · começou {ago(session.startedAt, now)}</span>}
      </span>
    </span>
  )
}

/** A cortina da abertura e do fim: a tela inteira no clima da mesa, com o foco preso nela. */
function Curtain({ labelledBy, end = false, onClose, children }: { labelledBy: string; end?: boolean; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useBackLayer(onClose)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // O foco vai para o botão principal sem rolar: o título, lá em cima, é o primeiro que se vê.
    root.current?.querySelector<HTMLElement>('[data-curtain-go]')?.focus({ preventScroll: true })
    return () => previous?.focus?.()
  }, [])
  return (
    <div
      ref={root}
      className={`session-opening${end ? ' is-end' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
        if (e.key === 'Tab') trapFocus(e, root.current)
      }}
    >
      <div className="session-opening-inner">{children}</div>
    </div>
  )
}

const customTitle = (s: Session) => sessionName(s.number, s.title)

/**
 * A abertura da sessão: o título, o que aconteceu na última vez, quem já está na mesa
 * e o convite. Fecha com "Começar a jogar".
 */
export function SessionOpening({ group, session, previous, onClose }: { group: Group; session: Session; previous: Session | undefined; onClose: () => void }) {
  const { universe } = useWorkspace()
  const party = partyOf(universe, group.id)
  const recap = previous ? playedLog(previous).filter((l) => l.kind === 'nota' && !/^Rodada \d+$/.test(l.text)).slice(-3) : []
  const title = customTitle(session)

  return (
    <Curtain labelledBy="abertura-titulo" onClose={onClose}>
      <span className="session-opening-emblem" aria-hidden="true">
        <Dices size={30} />
      </span>
      <p className="session-opening-kicker">
        {group.name} · Sessão {session.number}
      </p>
      <h2 id="abertura-titulo" className="session-opening-title">
        {title ?? 'A sessão começou'}
      </h2>
      {title && <p className="session-opening-sub">A sessão começou.</p>}

      {previous && (recap.length > 0 || previous.prep) && (
        <section className="session-opening-card" aria-labelledby="abertura-antes">
          <h3 id="abertura-antes" className="section-label">
            Na última sessão · {previous.title}
          </h3>
          {recap.length ? (
            <ul className="session-opening-recap">
              {recap.map((l) => (
                <li key={l.id}>{l.text}</li>
              ))}
            </ul>
          ) : (
            <p className="small">{previous.prep}</p>
          )}
        </section>
      )}

      {party.length > 0 && (
        <section className="session-opening-card" aria-labelledby="abertura-chamada">
          <h3 id="abertura-chamada" className="section-label">
            <UserCheck size={14} aria-hidden="true" /> Quem joga hoje
          </h3>
          <p className="small muted">Alguém não veio? O mestre conduz o personagem nesta sessão, ou ele fica de fora.</p>
          <AttendanceList session={session} group={group} />
        </section>
      )}

      <section className="session-opening-card" aria-labelledby="abertura-quem">
        <h3 id="abertura-quem" className="section-label">
          <Users size={14} aria-hidden="true" /> Na mesa agora
        </h3>
        <PresenceList groupId={group.id} empty={group.share ? 'Ninguém entrou ainda. Mostre o código para a mesa:' : undefined} />
        <InvitePanel group={group} compact />
      </section>

      <button type="button" data-curtain-go className="btn btn-primary btn-lg session-opening-go" onClick={onClose}>
        <Play size={18} /> Começar a jogar
      </button>
    </Curtain>
  )
}

/** O fim da sessão: quanto durou, o que rolou e para onde foi o registro. */
export function SessionClosing({ group, session, onClose }: { group: Group; session: Session; onClose: () => void }) {
  const { universe, go, readOnly } = useWorkspace()
  const [now] = useState(() => Date.now())
  const [writing, setWriting] = useState(false)
  const sum = sessionSummary(universe, session, now)
  const sent = playedLog(session).length > 0
  const title = customTitle(session)
  const stats: [string, string][] = [
    ...(sum.minutes !== null ? [['Durou', durationLabel(sum.minutes)] as [string, string]] : []),
    ['Rolagens', String(sum.rolls)],
    ['Notas', String(sum.notes)],
    ['Revelações', String(sum.revelations)],
  ]

  return (
    <Curtain labelledBy="fim-titulo" end onClose={onClose}>
      <span className="session-opening-emblem" aria-hidden="true">
        <Flag size={28} />
      </span>
      <p className="session-opening-kicker">
        {group.name} · Sessão {session.number}
      </p>
      <h2 id="fim-titulo" className="session-opening-title">
        Fim da sessão
      </h2>
      {title && <p className="session-opening-sub">{title}</p>}
      <dl className="session-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="session-opening-note">
        {sent ? 'O registro inteiro foi para Ideias: revise com calma e transforme o que aconteceu em fatos do mundo.' : 'Nada foi anotado nesta sessão.'}
        {group.share && ' Os celulares da mesa já sabem que a sessão terminou.'}
      </p>
      {!readOnly &&
        (writing ? (
          <section className="session-opening-card" aria-label="Diário da campanha">
            <RecapEditor session={session} />
          </section>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setWriting(true)}>
            <BookOpen size={16} /> Escrever o diário para os jogadores
          </button>
        ))}
      <div className="session-opening-actions">
        {sent && (
          <button
            type="button"
            data-curtain-go
            className="btn btn-primary btn-lg"
            onClick={() => {
              onClose()
              go('inbox')
            }}
          >
            <Inbox size={18} /> Revisar em Ideias
          </button>
        )}
        <button type="button" data-curtain-go={sent ? undefined : true} className={`btn btn-lg${sent ? ' btn-ghost' : ' btn-primary'}`} onClick={onClose}>
          Fechar
        </button>
      </div>
    </Curtain>
  )
}
