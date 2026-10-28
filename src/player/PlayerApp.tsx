import { Moon, Radio, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCodex, joinTable, type ServerConfig, type TableRoll } from '../share/server'
import { sameReveals, type CodexSnapshot } from '../share/snapshot'
import { recall, remember } from '../state/prefs'
import { PlayerTable, type FeedRoll } from './PlayerTable'
import { CodexDoc } from '../views/rpg/CodexDoc'
import { useMesaSector } from '../rpg/useMesaSector'
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
    })
    table.current = t
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      t.leave()
      table.current = null
    }
  }, [server, id, load])

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
        <span className={`player-live${live ? ' on' : ''}`} title={live ? 'Recebendo na hora' : 'Atualiza a cada 20 segundos'}>
          <Radio size={13} aria-hidden="true" /> {live ? 'ao vivo' : 'atualiza sozinho'}
        </span>
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
            <PlayerTable codex={codex} me={me && codex.party.some((p) => p.name === me) ? me : null} onMe={chooseMe} feed={feed} onRoll={roll} />
            <CodexDoc codex={codex} me={me ?? undefined} />
            {updatedAt && <p className="muted tiny player-foot">Atualizado às {timeFmt.format(new Date(updatedAt))} · feito com Papirus</p>}
          </>
        ) : null}
      </main>
    </div>
  )
}
