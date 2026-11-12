import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { auNews, canonize, type AUNews } from '../logic/au'
import type { Universe } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { openShared, sharedWithMe, shortName, type SharedWithMe } from './sharing'

const KIND: Record<AUNews['key'], string> = { entities: 'Ficha', relations: 'Ligação', events: 'Data', facts: 'Fato' }

/**
 * Os AUs feitos a partir deste mundo e mostrados ao autor ("Mostrar ao autor", no AU). O autor vê o
 * que nasceu ou mudou em cada um e escolhe o que vira canon aqui.
 */
export function AUsOfMyWorld() {
  const { universe, update } = useWorkspace()
  const { user, server } = useAccount()
  const [aus, setAus] = useState<{ item: SharedWithMe; au: Universe }[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<string | null>(null)

  const userId = user?.id
  const email = user?.email ?? ''
  useEffect(() => {
    if (!userId || !server) return
    let off = false
    void (async () => {
      try {
        const sb = await authClient(server)
        const items = await sharedWithMe(sb, userId, email)
        const loaded = await Promise.all(items.map(async (item) => ({ item, au: (await openShared(sb, item).catch(() => null))?.universe ?? null })))
        if (off) return
        setAus(loaded.flatMap(({ item, au }) => (au?.derivedFrom?.universeId === universe.id && au.derivedFrom.ownerId === userId ? [{ item, au }] : [])))
      } catch {
        // Sem rede: a seção só não aparece.
      }
    })()
    return () => {
      off = true
    }
  }, [userId, email, server, universe.id])

  const opened = aus.find((a) => a.au.id === openId)
  const news = useMemo(() => (opened ? auNews(opened.au, universe) : []), [opened, universe])

  if (!aus.length) return null
  return (
    <section className="share-section" aria-labelledby="share-aus">
      <h3 id="share-aus" className="share-title">
        <Sparkles size={14} aria-hidden="true" /> AUs do seu mundo
      </h3>
      <p className="muted small">Universos alternativos que partiram de “{universe.name}”. Escolha o que deles vira canon aqui; o resto fica só no AU.</p>
      <ul className="au-list">
        {aus.map(({ item, au }) => {
          const count = auNews(au, universe).length
          return (
            <li key={au.id}>
              <span>
                <strong>{au.name}</strong> <span className="muted small">de {shortName(item.owner_email)}</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                aria-expanded={openId === au.id}
                onClick={() => {
                  setOpenId(openId === au.id ? null : au.id)
                  setChosen(new Set())
                  setDone(null)
                }}
              >
                {count ? `Ver o que nasceu lá (${count})` : 'Nada novo'}
              </button>
            </li>
          )
        })}
      </ul>
      {opened && (
        <div className="au-canon" role="group" aria-label={`O que nasceu em ${opened.au.name}`}>
          {news.length ? (
            <>
              <ul className="au-news">
                {news.map((n) => (
                  <li key={n.id}>
                    <label className="wiki-check">
                      <input
                        type="checkbox"
                        checked={chosen.has(n.id)}
                        onChange={(e) => {
                          const next = new Set(chosen)
                          if (e.target.checked) next.add(n.id)
                          else next.delete(n.id)
                          setChosen(next)
                        }}
                      />
                      <span className="au-kind">{KIND[n.key]}</span> {n.label}
                      <span className={`au-chip au-chip-${n.state}`}>{n.state === 'novo' ? 'Nova no AU' : 'Mudou no AU'}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!chosen.size}
                onClick={() => {
                  const { extra } = canonize(universe, opened.au, [...chosen])
                  update((u) => canonize(u, opened.au, [...chosen]).universe)
                  const n = chosen.size
                  setDone(`Pronto: ${n} ${n === 1 ? 'coisa virou' : 'coisas viraram'} canon${extra.length ? ` (e ${extra.length} ${extra.length === 1 ? 'ficha foi junto' : 'fichas foram juntas'}, porque eram usadas)` : ''}.`)
                  setChosen(new Set())
                }}
              >
                Canonizar{chosen.size ? ` (${chosen.size})` : ''}
              </button>
            </>
          ) : (
            <p className="muted small">Tudo o que há neste AU já está no seu mundo, ou ainda não nasceu nada novo lá.</p>
          )}
          {done && (
            <p className="notice small" role="status">
              {done}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
