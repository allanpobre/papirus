import { Megaphone, Moon, Radio, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { alive, PRESENCE_EVERY, useNow, withPresence, type Present } from '../share/presence'
import { fetchCodex, joinTable, type ServerConfig, type TableNotice, type TablePresence, type TableRoll } from '../share/server'
import { revealedSince, sameReveals, type CodexSnapshot } from '../share/snapshot'
import { recall, remember } from '../state/prefs'
import { PlayerTable, type FeedRoll } from './PlayerTable'
import { CodexDoc } from '../views/rpg/CodexDoc'
import { useMesaSector } from '../rpg/useMesaSector'
import { sessionName } from '../rpg/sessionLife'
import { PageHelp } from '../ui/PageTour'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '../styles/mesa.css'

const POLL_MS = 20_000
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Um momento na tela inteira do celular: a sessão começou ou terminou, um aviso, uma revelação. */
interface Moment {
  id: string
  kind: 'comecou' | 'terminou' | 'aviso' | 'revelou'
  tone?: TableNotice['tone']
  kicker: string
  title: string
  sub: string
}

const NOTICE_KICKER: Record<TableNotice['tone'], string> = { aviso: 'Aviso do mestre', perigo: 'Perigo!', misterio: 'Algo acontece' }

/**
 * O Codex no celular dos jogadores: sem nada do universo além do que o mestre revelou.
 * Atualiza na hora pelo aviso do servidor e, por garantia, a cada 20 s. O jogador rola
 * pela própria ficha: a rolagem vai, pelo mesmo canal ao vivo, para o mestre e o grupo.
 */
export default function PlayerApp({ id, server }: { id: string; server: ServerConfig | null }) {
  const [codex, setCodex] = useState<CodexSnapshot | null>(null)
  const current = useRef<CodexSnapshot | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [state, setState] = useState<'carregando' | 'ok' | 'sumiu' | 'erro'>('carregando')
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)
  const [fresh, setFresh] = useState(false)
  const [me, setMe] = useState<string | null>(() => recall(`codex-eu:${id}`))
  const [feed, setFeed] = useState<FeedRoll[]>([])
  const table = useRef<ReturnType<typeof joinTable> | null>(null)
  // Quem está na mesa: este celular avisa (com o personagem escolhido) e ouve os outros.
  const [presenceId] = useState(() => crypto.randomUUID())
  const [people, setPeople] = useState<Present[]>([])
  const mine = useRef<TablePresence>({ id: presenceId, role: 'jogador', who: me })
  const now = useNow()
  // Os momentos na tela inteira (a sessão começou, um aviso do mestre, uma revelação), um de cada vez.
  const [moments, setMoments] = useState<Moment[]>([])
  const moment = moments[0] ?? null
  const push = useCallback((m: Moment) => setMoments((q) => (q.some((x) => x.id === m.id) ? q : [...q, m].slice(-4))), [])
  const dismiss = useCallback(() => setMoments((q) => q.slice(1)), [])
  // Os avisos já vistos: os que existiam ao abrir o Codex não pulam na tela.
  const seenNotices = useRef<Set<string> | null>(null)
  const showNotice = useCallback(
    (n: TableNotice) => {
      const seen = (seenNotices.current ??= new Set())
      if (seen.has(n.id)) return
      seen.add(n.id)
      push({ id: n.id, kind: 'aviso', tone: n.tone, kicker: NOTICE_KICKER[n.tone], title: n.text, sub: `às ${timeFmt.format(new Date(n.at))}` })
      navigator.vibrate?.(n.tone === 'perigo' ? [220, 90, 220, 90, 320] : [120, 80, 120])
    },
    [push],
  )
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.hasAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches))

  // O tema da mesa, escolhido pelo mestre; aqui só se troca entre claro e escuro.
  useMesaSector(codex?.theme ?? null, dark)

  const load = useCallback(async () => {
    if (!server) return
    try {
      const r = await fetchCodex(server, id)
      if (!r) {
        setState('sumiu')
        return
      }
      const prev = current.current
      // O aviso é para o que foi revelado; a vida do grupo e a vez no combate mudam o tempo todo.
      if (prev && !sameReveals(prev, r.data)) {
        setFresh(true)
        setTimeout(() => setFresh(false), 2500)
      }
      // Sessão que começa ou termina com o Codex aberto: um momento na tela inteira.
      const was = prev?.session ?? null
      const is = r.data.session ?? null
      if (prev && is && (!was || was.number !== is.number)) {
        push({ id: `comecou-${is.number}`, kind: 'comecou', kicker: 'A sessão começou', title: is.title || `Sessão ${is.number}`, sub: 'O mestre está na mesa. Boa sessão!' })
        navigator.vibrate?.([120, 80, 120])
      } else if (prev && was && !is) push({ id: `terminou-${was.number}`, kind: 'terminou', kicker: 'A sessão terminou', title: was.title || `Sessão ${was.number}`, sub: 'Até a próxima.' })
      // Avisos do mestre que ainda não apareceram (chegam também pelo canal, na hora).
      const notices = r.data.notices ?? []
      if (prev) notices.forEach(showNotice)
      else for (const n of notices) (seenNotices.current ??= new Set()).add(n.id)
      // Os testes pedidos (e a iniciativa) abrem no meio da tela, com o botão de rolar: ficam no PlayerTable.
      // O que o mestre acabou de revelar.
      const learned = prev ? revealedSince(prev, r.data) : []
      if (learned.length)
        push({
          id: `revelou-${r.updatedAt}`,
          kind: 'revelou',
          kicker: 'O mestre revelou',
          title: learned[0],
          sub: learned.length > 1 ? `e mais ${learned.length - 1} ${learned.length > 2 ? 'novidades' : 'novidade'} no Codex` : 'Está no Codex.',
        })
      current.current = r.data
      setCodex(r.data)
      setUpdatedAt(r.updatedAt)
      setState('ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState((s) => (s === 'ok' ? 'ok' : 'erro'))
    }
  }, [server, id, push, showNotice])

  useEffect(() => {
    if (!server) return
    const first = setTimeout(() => void load(), 0)
    const timer = setInterval(() => void load(), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    const t = joinTable(server, id, {
      update: () => void load(),
      status: setLive,
      roll: (r) => setFeed((f) => (f.some((x) => x.id === r.id) ? f : [r, ...f].slice(0, 12))),
      check: (c) => setFeed((f) => f.map((x) => (x.id === c.id ? { ...x, verdict: c.verdict, tone: c.tone, checked: true } : x))),
      presence: (p) => setPeople((l) => withPresence(l, p, Date.now())),
      left: (gone) => setPeople((l) => l.filter((p) => p.id !== gone)),
      ask: () => void t.sendPresence(mine.current).catch(() => undefined),
      notice: showNotice,
    })
    table.current = t
    // Chegou: pergunta quem já está e avisa que está; depois, avisa de tempos em tempos.
    void t.ask().catch(() => undefined)
    void t.sendPresence(mine.current).catch(() => undefined)
    const beat = setInterval(() => document.visibilityState === 'visible' && void t.sendPresence(mine.current).catch(() => undefined), PRESENCE_EVERY)
    const onBack = () => document.visibilityState === 'visible' && void t.sendPresence(mine.current).catch(() => undefined)
    const onLeave = () => void t.sendLeft(mine.current.id).catch(() => undefined)
    document.addEventListener('visibilitychange', onBack)
    addEventListener('pagehide', onLeave)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('visibilitychange', onBack)
      removeEventListener('pagehide', onLeave)
      onLeave()
      t.leave()
      table.current = null
    }
  }, [server, id, load, showNotice])

  // Trocou de personagem: a mesa fica sabendo.
  useEffect(() => {
    mine.current = { id: presenceId, role: 'jogador', who: me }
    void table.current?.sendPresence(mine.current).catch(() => undefined)
  }, [me, presenceId])

  // O momento some sozinho depois de um tempo (ou com um toque, ou Esc), e vem o próximo.
  useEffect(() => {
    if (!moment) return
    const t = setTimeout(dismiss, 6000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      removeEventListener('keydown', onKey)
    }
  }, [moment, dismiss])

  const roll = (r: TableRoll) => {
    setFeed((f) => [{ ...r, mine: true }, ...f].slice(0, 12))
    void table.current?.sendRoll(r).catch(() => undefined)
  }
  const chooseMe = (name: string | null) => {
    setMe(name)
    remember(`codex-eu:${id}`, name)
  }

  useEffect(() => {
    document.title = codex ? `Codex · ${codex.group}` : 'Codex'
  }, [codex])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  return (
    <div className={`player${codex ? ' has-dock' : ''}`}>
      <header className="player-top">
        <span className="player-brand">{codex ? codex.universe : 'Codex'}</span>
        {codex?.session && (
          <span className="player-session" title={codex.session.title}>
            <span className="live-dot" aria-hidden="true" /> Sessão {codex.session.number}
          </span>
        )}
        <span className={`player-live${live ? ' on' : ''}`} title={live ? 'Recebendo na hora' : 'Atualiza a cada 20 segundos'}>
          <Radio size={13} aria-hidden="true" /> {live ? 'ao vivo' : 'atualiza sozinho'}
        </span>
        <PageHelp tour="codex-jogador" />
        <button type="button" className="btn-icon" aria-label={dark ? 'Tema claro' : 'Tema escuro'} onClick={toggleTheme}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>
      <main className={`player-main${fresh ? ' player-fresh' : ''}`}>
        {!server ? (
          <p className="notice notice-error">Este link está incompleto: falta o endereço do servidor. Peça um link novo ao mestre.</p>
        ) : state === 'carregando' ? (
          <p className="muted">Abrindo o Codex…</p>
        ) : state === 'sumiu' ? (
          <p className="notice">Este Codex não está mais compartilhado. Peça um link novo ao mestre.</p>
        ) : state === 'erro' && !codex ? (
          <p className="notice notice-error" role="alert">
            Não foi possível abrir o Codex: {error}
          </p>
        ) : codex ? (
          <>
            {fresh && (
              <p className="player-new" role="status">
                Novidades do mestre
              </p>
            )}
            <AtTable people={alive(people, now)} session={codex.session ?? null} me={me && codex.party.some((p) => p.name === me) ? me : null} />
            {codex.session && codex.notices?.length ? <LastNotice notice={codex.notices.at(-1)!} /> : null}
            <PlayerTable codex={codex} me={me && codex.party.some((p) => p.name === me) ? me : null} onMe={chooseMe} feed={feed} onRoll={roll} />
            <CodexDoc codex={codex} me={me ?? undefined} />
            {updatedAt && <p className="muted tiny player-foot">Atualizado às {timeFmt.format(new Date(updatedAt))} · feito com Papirus</p>}
          </>
        ) : null}
      </main>
      {moment && (
        <div key={moment.id} className={`player-moment is-${moment.kind}${moment.tone ? ` tone-${moment.tone}` : ''}`} role={moment.tone === 'perigo' ? 'alert' : 'status'} onClick={dismiss}>
          <p className="player-moment-kicker">{moment.kicker}</p>
          <p className="player-moment-title">{moment.title}</p>
          <p className="player-moment-sub">{moment.sub}</p>
        </div>
      )}
    </div>
  )
}

/** O último aviso do mestre, para quem piscou e perdeu. */
function LastNotice({ notice }: { notice: TableNotice }) {
  return (
    <p className={`player-notice tone-${notice.tone}`}>
      <Megaphone size={15} aria-hidden="true" />
      <span>
        <span className="player-notice-h">
          {NOTICE_KICKER[notice.tone]} · {timeFmt.format(new Date(notice.at))}
        </span>{' '}
        {notice.text}
      </span>
    </p>
  )
}

/** Quem está na mesa agora, visto do celular: o mestre e os jogadores (pelo personagem). */
function AtTable({ people, session, me }: { people: Present[]; session: CodexSnapshot['session'] | null; me: string | null }) {
  const gm = people.some((p) => p.role === 'mestre')
  const names = [...new Set(people.filter((p) => p.role === 'jogador' && p.who !== me).map((p) => p.who ?? 'alguém'))]
  if (!gm && !names.length && !session) return null
  return (
    <section className="player-people" aria-label="Na mesa agora">
      <span className="player-people-h">{session ? [`Sessão ${session.number}`, sessionName(session.number, session.title)].filter(Boolean).join(' · ') : 'Na mesa agora'}</span>
      <span className="player-people-list">
        {gm && <span className="player-person is-gm">Mestre</span>}
        {names.map((n) => (
          <span key={n} className="player-person">
            {n}
          </span>
        ))}
        <span className="player-person is-me">{me ? `${me} (você)` : 'você'}</span>
      </span>
    </section>
  )
}
