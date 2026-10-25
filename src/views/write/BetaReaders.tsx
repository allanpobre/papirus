import { Check, MessageCircle, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { authClient, useAccount } from '../../account/auth'
import { timeAgo } from '../../logic/history'
import { deleteFeedback, listFeedback, resolveFeedback, type Feedback } from '../../share/feedback'
import { useWorkspace } from '../../state/workspace'

/** Comentários dos leitores beta deste universo, buscados uma vez por abertura (e a cada ação). */
let cache: { key: string; list: Feedback[]; at: number } | null = null
/** Depois disto, ao trocar de cena, busca de novo. */
const FRESH_MS = 30_000
let loading: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function useBetaFeedback(sceneId: string): Feedback[] {
  const { universe, source } = useWorkspace()
  const { user, server } = useAccount()
  const key = user && server && source.kind === 'proprio' ? `${user.id}:${universe.id}` : null
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (key && cache?.key === key ? cache.list : EMPTY),
  )
  useEffect(() => {
    if (!key || !user || !server || loading === key || (cache?.key === key && Date.now() - cache.at < FRESH_MS)) return
    loading = key
    void authClient(server)
      .then((sb) => listFeedback(sb, user.id, universe.id))
      .then((got) => {
        cache = { key, list: got, at: Date.now() }
        emit()
      })
      // Sem o script no servidor (ou sem rede), a seção simplesmente não aparece.
      .catch(() => undefined)
      .finally(() => {
        loading = null
      })
  }, [key, user, server, universe.id, sceneId])
  return list
}
const EMPTY: Feedback[] = []

function change(id: string, next: Feedback | null) {
  if (!cache) return
  cache = { ...cache, list: next ? cache.list.map((f) => (f.id === id ? next : f)) : cache.list.filter((f) => f.id !== id) }
  emit()
}

/** Na margem do Escrever: o que os leitores beta disseram sobre esta cena. */
export function BetaReadersSection({ sceneId }: { sceneId: string }) {
  const { toast } = useWorkspace()
  const { server } = useAccount()
  const all = useBetaFeedback(sceneId)
  const here = all.filter((f) => f.scene_id === sceneId)
  if (!here.length || !server) return null
  const open = here.filter((f) => !f.resolved).length

  const act = async (f: Feedback, run: (sb: Awaited<ReturnType<typeof authClient>>) => Promise<void>, next: Feedback | null) => {
    try {
      await run(await authClient(server))
      change(f.id, next)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { tone: 'erro' })
    }
  }

  return (
    <section className="margin-section beta-readers" aria-labelledby="beta-titulo">
      <h3 id="beta-titulo" className="section-label">
        <MessageCircle size={13} aria-hidden="true" /> Leitores beta {open > 0 && <span className="beta-count">{open}</span>}
      </h3>
      <ul className="beta-list">
        {here.map((f) => (
          <li key={f.id} className={`beta-item${f.resolved ? ' is-resolved' : ''}`}>
            {f.quote && <blockquote className="beta-quote tiny">{f.quote}</blockquote>}
            <p className="small">{f.body}</p>
            <p className="muted tiny">
              {f.author_name || 'Leitor sem nome'} · {timeAgo(f.created_at)}
            </p>
            <div className="beta-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void act(f, (sb) => resolveFeedback(sb, f.id, !f.resolved), { ...f, resolved: !f.resolved })}
              >
                {f.resolved ? <RotateCcw size={13} /> : <Check size={13} />} {f.resolved ? 'Reabrir' : 'Resolvido'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Apagar o comentário" onClick={() => void act(f, (sb) => deleteFeedback(sb, f.id), null)}>
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
