import { ArrowLeft, Check, Cloud, CloudOff, Flame, RotateCcw, Trash2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Modal } from '../ui/Modal'
import { attemptsOf, pace, recordOf, removeTreino, scoreOf, summary, unitLabel, useTreinos, type Treino } from './treino'
import type { TreinoCloudState } from './useTreinoSync'

const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const day = (key: string) => dayFmt.format(new Date(`${key}T12:00:00`))
const minutes = (m: number) => (m === 0 ? 'sem tempo' : `${m} min`)

function line(t: Treino) {
  return `${minutes(t.minutes)} · ${scoreOf(t).toLocaleString('pt-BR')}${t.target ? ` de ${t.target.toLocaleString('pt-BR')}` : ''} ${unitLabel(t.unit, t.target || scoreOf(t))}`
}

/** A nuvem dos treinos, numa linha. */
export function TreinoCloudLine({ cloud }: { cloud: TreinoCloudState }) {
  if (cloud.state === 'sem-conta')
    return (
      <p className="treino-cloud muted small">
        <CloudOff size={14} aria-hidden="true" /> Só neste aparelho. Entre numa conta para guardar os treinos na nuvem.
      </p>
    )
  if (cloud.state === 'erro')
    return (
      <p className="treino-cloud treino-cloud-error small" role="status">
        <CloudOff size={14} aria-hidden="true" /> Não foi para a nuvem: {cloud.error}
      </p>
    )
  return (
    <p className="treino-cloud muted small" role="status">
      <Cloud size={14} aria-hidden="true" /> {cloud.state === 'guardando' ? 'Guardando na nuvem…' : 'Guardados na sua conta.'}
    </p>
  )
}

/** Os treinos feitos: o resumo, a lista e cada tentativa com o texto, para reler e refazer. */
export function TreinoHistory({ cloud, onClose, onRedo, onDeleted }: { cloud: TreinoCloudState; onClose: () => void; onRedo: (t: Treino) => void; onDeleted: () => void }) {
  const list = useTreinos()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = list.find((t) => t.id === openId)
  const s = summary(list)

  if (open) {
    const tries = attemptsOf(list, open)
    const best = recordOf(list, open)
    return (
      <Modal title="Treino" size="md" onClose={onClose}>
        <div className="treino-detail">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>
            <ArrowLeft size={15} /> Todos os treinos
          </button>
          <p className="treino-kicker">{day(open.day)}</p>
          <p className="treino-prompt">{open.prompt}</p>
          <p className={`treino-badge${open.done ? ' is-done' : ''}`}>
            {open.done && <Check size={14} aria-hidden="true" />} {line(open)} · {pace(open)} pal./min
            {best?.id === open.id && tries.length > 1 && (
              <>
                {' '}
                · <Trophy size={13} aria-label="recorde" /> recorde
              </>
            )}
          </p>
          <div className="treino-text">{open.text}</div>
          {tries.length > 1 && (
            <>
              <h3 className="treino-h">Tentativas deste desafio</h3>
              <ul className="treino-tries">
                {tries.map((t) => (
                  <li key={t.id} aria-current={t.id === open.id || undefined}>
                    <button type="button" className="link-btn" onClick={() => setOpenId(t.id)}>
                      {day(t.day)}
                    </button>{' '}
                    <span className="muted small">{line(t)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="treino-detail-actions">
            <button type="button" className="btn btn-primary" onClick={() => onRedo(open)}>
              <RotateCcw size={16} /> Refazer este desafio
            </button>
            <ConfirmButton
              className="btn btn-ghost"
              question="Apagar este treino daqui e da nuvem?"
              confirmLabel="Apagar"
              onConfirm={() => {
                removeTreino(open.id)
                setOpenId(null)
                onDeleted()
              }}
            >
              <Trash2 size={16} /> Apagar
            </ConfirmButton>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Seus treinos" size="md" onClose={onClose}>
      <div className="treino-history">
        <dl className="treino-stats">
          <div>
            <dt>Treinos</dt>
            <dd className="tabular">{s.total}</dd>
          </div>
          <div>
            <dt>Mínimo batido</dt>
            <dd className="tabular">{s.done}</dd>
          </div>
          <div>
            <dt>
              <Flame size={13} aria-hidden="true" /> Dias seguidos
            </dt>
            <dd className="tabular">{s.streak}</dd>
          </div>
          <div>
            <dt>Melhor ritmo</dt>
            <dd className="tabular">{s.bestPace} pal./min</dd>
          </div>
        </dl>
        <TreinoCloudLine cloud={cloud} />
        {list.length === 0 ? (
          <p className="muted">Nenhum treino ainda. O primeiro leva cinco minutos.</p>
        ) : (
          <ul className="treino-list" aria-label="Treinos feitos">
            {list.map((t) => (
              <li key={t.id}>
                <button type="button" className="treino-item" onClick={() => setOpenId(t.id)}>
                  <span className={`treino-dot${t.done ? ' is-done' : ''}`} aria-hidden="true">
                    {t.done ? <Check size={13} /> : null}
                  </span>
                  <span className="treino-item-text">
                    <span className="muted tiny">
                      {day(t.day)}
                      {t.daily ? ' · desafio do dia' : ''}
                    </span>
                    <span className="treino-item-prompt">{t.prompt}</span>
                    <span className="small">{line(t)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
