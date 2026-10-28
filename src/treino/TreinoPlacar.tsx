import { Lock, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { Avatar } from '../social/SocialDialog'
import { recall, remember } from '../state/prefs'
import { Modal } from '../ui/Modal'
import { loadPlacar, localPoints, myPlacarSetting, periodStart, setPlacarSetting, type PlacarEscopo, type PlacarPeriodo, type PlacarRow, type PlacarVisibilidade } from './placar'
import { useTreinos } from './treino'

const MEDAL = ['🥇', '🥈', '🥉']
const VIS: [PlacarVisibilidade, string][] = [
  ['ninguem', 'Ninguém'],
  ['amigos', 'Amigos'],
  ['todos', 'Todo mundo'],
]

/**
 * O placar dos treinos: entre amigos ou de todo mundo, na semana ou no mês. Pontos são
 * minutos de treino com o mínimo batido (até 60 por dia); os textos nunca aparecem.
 */
export function TreinoPlacar({ onClose, onAccount }: { onClose: () => void; onAccount?: () => void }) {
  const account = useAccount()
  const list = useTreinos()
  const [escopo, setEscopo] = useState<PlacarEscopo>(() => (recall('placar-escopo') === 'todos' ? 'todos' : 'amigos'))
  const [periodo, setPeriodo] = useState<PlacarPeriodo>(() => (recall('placar-periodo') === 'mes' ? 'mes' : 'semana'))
  const [rows, setRows] = useState<PlacarRow[] | null>(null)
  const [vis, setVis] = useState<PlacarVisibilidade | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const desde = periodStart(periodo)
  const mine = localPoints(list, desde)
  const userId = account.user?.id
  const server = account.server

  useEffect(() => {
    if (!userId || !server) return
    let off = false
    void (async () => {
      try {
        const sb = await authClient(server)
        const [r, v] = await Promise.all([loadPlacar(sb, escopo, desde), myPlacarSetting(sb, userId)])
        if (off) return
        setRows(r)
        setVis(v)
        setError(null)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [userId, server, escopo, desde])

  const changeVis = async (v: PlacarVisibilidade) => {
    if (!userId || !server) return
    const before = vis
    setVis(v)
    try {
      await setPlacarSetting(await authClient(server), userId, v)
      setRows(await loadPlacar(await authClient(server), escopo, desde))
    } catch (err) {
      setVis(before)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const me = rows?.find((r) => r.user_id === userId)
  // A própria linha aparece sempre, mas os outros só a veem se a escolha permitir.
  const hidden = me && (vis === 'ninguem' || vis === null || (escopo === 'todos' && vis !== 'todos'))

  return (
    <Modal title="Placar dos treinos" size="md" onClose={onClose} help="placar">
      <div className="placar">
        <div className="placar-switches">
          <div className="segmented" role="radiogroup" aria-label="Placar de quem">
            {(
              [
                ['amigos', 'Amigos'],
                ['todos', 'Todo mundo'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={escopo === k}
                onClick={() => {
                  setEscopo(k)
                  remember('placar-escopo', k)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="segmented" role="radiogroup" aria-label="Período">
            {(
              [
                ['semana', 'Semana'],
                ['mes', 'Mês'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={periodo === k}
                onClick={() => {
                  setPeriodo(k)
                  remember('placar-periodo', k)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!account.user ? (
          <div className="placar-empty">
            <p>
              <strong>{mine}</strong> {mine === 1 ? 'ponto' : 'pontos'} {periodo === 'semana' ? 'nesta semana' : 'neste mês'}, neste aparelho.
            </p>
            <p className="muted small">Com uma conta, os treinos vão para a nuvem e você entra no placar dos amigos (e no de todo mundo, se quiser).</p>
            {onAccount && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onAccount}>
                Criar conta ou entrar
              </button>
            )}
          </div>
        ) : error ? (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        ) : rows === null ? (
          <p className="muted">Carregando o placar…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Ninguém pontuou ainda. Que tal ser a primeira pessoa?</p>
        ) : (
          <ol className="placar-list" aria-label="Placar">
            {rows.map((r) => (
              <li key={r.user_id} className={r.user_id === userId ? 'is-me' : undefined}>
                <span className="placar-pos" aria-label={`${r.posicao}º lugar`}>
                  {MEDAL[r.posicao - 1] ?? `${r.posicao}º`}
                </span>
                <Avatar p={{ avatar: null, name: r.name, handle: r.handle }} size={34} />
                <span className="placar-who">
                  <strong>{r.user_id === userId ? 'Você' : r.name || `@${r.handle}`}</strong>
                  <span className="muted tiny">
                    @{r.handle} · {r.dias} {r.dias === 1 ? 'dia' : 'dias'} · {r.treinos} {r.treinos === 1 ? 'treino' : 'treinos'}
                  </span>
                </span>
                <span className="placar-pts">
                  <strong className="tabular">{r.pontos}</strong>
                  <span className="muted tiny">pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {account.user && rows !== null && !me && !error && (
          <p className="muted small">
            Você ainda não pontuou {periodo === 'semana' ? 'nesta semana' : 'neste mês'}
            {mine > 0 ? ` (neste aparelho: ${mine} pontos, que entram quando forem para a nuvem)` : ''}.
          </p>
        )}
        {hidden && (
          <p className="muted small placar-hidden">
            <Lock size={13} aria-hidden="true" /> Só você vê a sua linha aqui. Para aparecer, mude quem vê os seus pontos.
          </p>
        )}

        {account.user && (
          <section className="placar-vis" aria-labelledby="placar-vis">
            <h3 id="placar-vis" className="placar-h">
              Quem vê os seus pontos
            </h3>
            {vis === null ? (
              <p className="muted small">Crie o seu @ em Sua conta → Perfil para aparecer no placar.</p>
            ) : (
              <div className="segmented" role="radiogroup" aria-labelledby="placar-vis">
                {VIS.map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={vis === k} disabled={vis === undefined} onClick={() => void changeVis(k)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <p className="muted tiny placar-how">
          <Trophy size={12} aria-hidden="true" /> Pontos são os minutos de treino com o mínimo batido, até 60 por dia: vale escrever um pouco todo dia. O servidor confere cada treino
          (pelo texto, sem mostrar a ninguém) e deixa de fora o que foi colado ou chegou dias depois.
        </p>
      </div>
    </Modal>
  )
}
