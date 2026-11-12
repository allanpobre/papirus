import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { auRequests, isMissing, openWorldsOf, setWorldOpen, type AURequest } from '../social/community'
import { profilesByIds, type Profile } from '../social/social'
import { useWorkspace } from '../state/workspace'

/**
 * Pedidos de AU pelo perfil: o autor abre este mundo a pedidos (aparece em "Mundos abertos a AU"
 * no perfil dele) e responde a quem pediu. Aceitar convida a pessoa com "Pode ver e criar um AU".
 */
export function AURequests({ busy, onAccept, onDecline }: { busy: boolean; onAccept: (r: AURequest) => void; onDecline: (r: AURequest) => void }) {
  const { universe } = useWorkspace()
  const { user, server } = useAccount()
  const [open, setOpen] = useState<boolean | null>(null)
  const [pending, setPending] = useState<AURequest[]>([])
  const [people, setPeople] = useState<Map<string, Profile>>(new Map())
  const [missing, setMissing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const userId = user?.id

  useEffect(() => {
    if (!userId || !server) return
    let off = false
    void (async () => {
      try {
        const sb = await authClient(server)
        const [worlds, reqs] = await Promise.all([openWorldsOf(sb, userId), auRequests(sb, userId)])
        const list = reqs.toMe.filter((r) => r.universe_id === universe.id && r.status === 'pendente')
        const who = await profilesByIds(sb, list.map((r) => r.requester))
        if (off) return
        setOpen(worlds.some((w) => w.universe_id === universe.id))
        setPending(list)
        setPeople(who)
      } catch (err) {
        if (!off) setMissing(isMissing(err))
      }
    })()
    return () => {
      off = true
    }
  }, [userId, server, universe.id, nonce, busy])

  if (missing || open === null || !userId || !server) return null
  return (
    <section className="share-section" aria-labelledby="share-au-pedidos">
      <h3 id="share-au-pedidos" className="share-title">
        <Sparkles size={14} aria-hidden="true" /> Pedidos de AU pelo perfil
      </h3>
      <label className="toggle small">
        <input
          type="checkbox"
          role="switch"
          checked={open}
          onChange={(e) => {
            const on = e.target.checked
            setOpen(on)
            void authClient(server)
              .then((sb) => setWorldOpen(sb, userId, universe, on))
              .then(() => setNonce((n) => n + 1))
              .catch(() => setOpen(!on))
          }}
        />
        <span className="toggle-track" aria-hidden="true" />
        <span>Aceitar pedidos de AU pelo meu perfil</span>
      </label>
      <p className="muted tiny">
        {open
          ? `“${universe.name}” aparece em “Mundos abertos a AU” no seu perfil. Quem tem conta pede; você aceita ou não. Os segredos nunca vão.`
          : 'Ligado, o mundo aparece no seu perfil e qualquer pessoa com conta pode pedir para criar um AU, sem você precisar saber o e-mail dela.'}
      </p>
      {pending.length > 0 && (
        <ul className="au-list" aria-label="Pedidos esperando resposta">
          {pending.map((r) => {
            const who = people.get(r.requester)
            return (
              <li key={r.requester}>
                <span>
                  <strong>{who ? who.name || `@${who.handle}` : r.requester_email}</strong>
                  {r.message && <span className="small muted"> “{r.message}”</span>}
                </span>
                <span className="inline-fields">
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onAccept(r)}>
                    Aceitar
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onDecline(r)}>
                    Recusar
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
