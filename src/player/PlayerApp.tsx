import { Moon, Radio, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { alive, PRESENCE_EVERY, useNow, withPresence, type Present } from '../share/presence'
import { fetchCodex, joinTable, type ServerConfig, type TablePresence, type TableRoll } from '../share/server'
import { sameReveals, type CodexSnapshot } from '../share/snapshot'
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
  // A sessão começou ou terminou desde a última vez que o Codex chegou.
  const [moment, setMoment] = useState<{ kind: 'comecou' | 'terminou'; title: string; number: number } | null>(null)
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
        setMoment({ kind: 'comecou', title: is.title, number: is.number })
        navigator.vibrate?.([120, 80, 120])
      } else if (prev && was && !is) setMoment({ kind: 'terminou', title: was.title, number: was.number })
      current.current = r.data
      setCodex(r.data)
      setUpdatedAt(r.updatedAt)
      setState('ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState((s) => (s === 'ok' ? 'ok' : 'erro'))
    }
  }, [server, id])

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
  }, [server, id, load])

  // Trocou de personagem: a mesa fica sabendo.
  useEffect(() => {
    mine.current = { id: presenceId, role: 'jogador', who: me }
    void table.current?.sendPresence(mine.current).catch(() => undefined)
  }, [me, presenceId])

  // O momento some sozinho depois de um tempo (ou com um toque, ou Esc).
  useEffect(() => {
    if (!moment) return
    const t = setTimeout(() => setMoment(null), 6000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoment(null)
    addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      removeEventListener('keydown', onKey)
    }
  }, [moment])

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
            <PlayerTable codex={codex} me={me && codex.party.some((p) => p.name === me) ? me : null} onMe={chooseMe} feed={feed} onRoll={roll} />
            <CodexDoc codex={codex} me={me ?? undefined} />
            {updatedAt && <p className="muted tiny player-foot">Atualizado às {timeFmt.format(new Date(updatedAt))} · feito com Papirus</p>}
          </>
        ) : null}
      </main>
      {moment && (
        <div className={`player-moment is-${moment.kind}`} role="status" onClick={() => setMoment(null)}>
          <p className="player-moment-kicker">{moment.kind === 'comecou' ? 'A sessão começou' : 'A sessão terminou'}</p>
          <p className="player-moment-title">{moment.title || `Sessão ${moment.number}`}</p>
          <p className="player-moment-sub">{moment.kind === 'comecou' ? 'O mestre está na mesa. Boa sessão!' : 'Até a próxima.'}</p>
        </div>
      )}
    </div>
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
