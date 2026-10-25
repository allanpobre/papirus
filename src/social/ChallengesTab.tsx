import type { SupabaseClient } from '@supabase/supabase-js'
import { Flame, LogOut, Plus, Trash2, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { todayKey } from '../logic/stats'
import { ConfirmButton } from '../ui/ConfirmButton'
import { todayTotal } from './dailyWords'
import {
  challengeBoards,
  createChallenge,
  daysBetween,
  deleteChallenge,
  joinChallenge,
  leaveChallenge,
  pushChallengeWords,
  type ChallengeBoard,
} from './social'

const DURATIONS = [7, 14, 30] as const
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtDay = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`))

/** Desafios de escrita com amigos: meta de palavras por dia, placar e sequência de dias. */
export function ChallengesTab({ myId, client }: { myId: string; client: () => Promise<SupabaseClient> }) {
  const today = todayKey()
  const [boards, setBoards] = useState<ChallengeBoard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState(500)
  const [days, setDays] = useState<number>(7)

  useEffect(() => {
    let off = false
    void (async () => {
      try {
        const sb = await client()
        // Antes de mostrar o placar, manda as palavras de hoje deste aparelho.
        await pushChallengeWords(sb, myId, today, todayTotal()).catch(() => 0)
        const list = await challengeBoards(sb, myId, today)
        if (!off) setBoards(list)
      } catch (err) {
        if (!off) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      off = true
    }
  }, [client, myId, today, nonce])

  const act = async (fn: (sb: SupabaseClient) => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn(await client())
      setNonce((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const mine = boards?.filter((b) => b.joined) ?? []
  const open = boards?.filter((b) => !b.joined && b.challenge.ends_on >= today) ?? []

  return (
    <div className="challenges">
      {error && (
        <p className="notice notice-error small" role="alert">
          {error}
        </p>
      )}
      <p className="small muted">
        Hoje você escreveu <strong>{todayTotal().toLocaleString('pt-BR')}</strong> palavras neste aparelho (somando todos os universos). O placar atualiza sozinho enquanto você escreve.
      </p>

      {creating ? (
        <form
          className="challenge-form"
          onSubmit={(e) => {
            e.preventDefault()
            void act((sb) => createChallenge(sb, myId, { title, daily_goal: goal, days }, today)).then(() => {
              setCreating(false)
              setTitle('')
            })
          }}
        >
          <label className="social-field">
            <span className="field-label">Nome do desafio</span>
            <input className="input" value={title} maxLength={80} placeholder="Ex.: Semana do primeiro rascunho" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="social-field">
            <span className="field-label">Meta por dia (palavras)</span>
            <input className="input" type="number" min={50} max={20000} step={50} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
          </label>
          <div className="social-field">
            <span className="field-label" id="duracao">
              Duração
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="duracao">
              {DURATIONS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)}>
                  {d} dias
                </button>
              ))}
            </div>
          </div>
          <p className="muted tiny">Começa hoje. Seus amigos veem o desafio e podem entrar; o placar só aparece para quem participa.</p>
          <div className="social-row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !title.trim() || goal < 50}>
              <Flame size={15} /> Criar desafio
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-sm challenge-new" onClick={() => setCreating(true)}>
          <Plus size={15} /> Novo desafio
        </button>
      )}

      {!boards ? (
        <p className="muted small">Carregando…</p>
      ) : (
        <>
          {mine.length === 0 && !creating && <p className="muted small">Nenhum desafio ainda. Crie um e chame os amigos, ou entre num desafio deles.</p>}
          {mine.map((b) => (
            <Board key={b.challenge.id} board={b} myId={myId} today={today} busy={busy} onLeave={() => void act((sb) => leaveChallenge(sb, myId, b.challenge.id))} onDelete={() => void act((sb) => deleteChallenge(sb, b.challenge.id))} />
          ))}
          {open.length > 0 && (
            <section aria-labelledby="desafios-amigos">
              <h3 id="desafios-amigos" className="social-h">
                <Users size={15} aria-hidden="true" /> Desafios de amigos
              </h3>
              <ul className="social-list">
                {open.map((b) => (
                  <li key={b.challenge.id} className="social-person">
                    <span className="social-person-name">
                      <strong>{b.challenge.title}</strong>
                      <span className="muted tiny">
                        {b.challenge.daily_goal.toLocaleString('pt-BR')} palavras por dia · até {fmtDay(b.challenge.ends_on)} · {b.members.length} {b.members.length === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    </span>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act((sb) => joinChallenge(sb, myId, b.challenge.id))}>
                      Entrar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Board({ board, myId, today, busy, onLeave, onDelete }: { board: ChallengeBoard; myId: string; today: string; busy: boolean; onLeave: () => void; onDelete: () => void }) {
  const c = board.challenge
  const total = daysBetween(c.starts_on, c.ends_on)
  const day = Math.min(total, Math.max(1, daysBetween(c.starts_on, today)))
  const over = today > c.ends_on
  return (
    <section className="challenge-board" aria-label={`Desafio ${c.title}`}>
      <header className="challenge-head">
        <div>
          <h3 className="challenge-title">{c.title}</h3>
          <p className="muted tiny">
            {c.daily_goal.toLocaleString('pt-BR')} palavras por dia · {over ? `acabou em ${fmtDay(c.ends_on)}` : `dia ${day} de ${total}`}
          </p>
        </div>
        {c.owner === myId ? (
          <ConfirmButton className="btn-icon btn-sm" title="Apagar o desafio" question="Apagar este desafio para todo mundo?" confirmLabel="Apagar" onConfirm={onDelete}>
            <Trash2 size={15} aria-label="Apagar o desafio" />
          </ConfirmButton>
        ) : (
          <button type="button" className="btn-icon btn-sm" title="Sair do desafio" aria-label="Sair do desafio" disabled={busy} onClick={onLeave}>
            <LogOut size={15} />
          </button>
        )}
      </header>
      <ol className="challenge-rank">
        {board.members.map((m, i) => {
          const pct = Math.min(100, Math.round((m.today / c.daily_goal) * 100))
          return (
            <li key={m.profile.user_id} className={`challenge-row${m.profile.user_id === myId ? ' is-me' : ''}`}>
              <span className="challenge-pos" aria-label={`${i + 1}º lugar`}>
                {i === 0 && m.total > 0 ? <Trophy size={15} aria-hidden="true" /> : `${i + 1}º`}
              </span>
              <span className="challenge-who">
                <strong>{m.profile.user_id === myId ? 'Você' : m.profile.name || `@${m.profile.handle}`}</strong>
                <span className="challenge-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-done' : undefined} />
                </span>
                <span className="muted tiny">
                  Hoje {m.today.toLocaleString('pt-BR')} · total {m.total.toLocaleString('pt-BR')} · meta batida em {m.daysHit} {m.daysHit === 1 ? 'dia' : 'dias'}
                </span>
              </span>
              {m.streak > 0 && (
                <span className="challenge-streak" title="Dias seguidos batendo a meta">
                  <Flame size={14} aria-hidden="true" /> {m.streak}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
