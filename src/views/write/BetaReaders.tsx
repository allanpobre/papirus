import { Check, MessageCircle, RotateCcw, Trash2 } from 'lucide-react'
import { authClient, useAccount } from '../../account/auth'
import { timeAgo } from '../../logic/history'
import { deleteFeedback, resolveFeedback, type Feedback } from '../../share/feedback'
import { useWorkspace } from '../../state/workspace'
import { change, useBetaFeedback } from './betaFeedback'


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
