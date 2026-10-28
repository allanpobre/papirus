import { ArrowLeft, Check, Dices, Flag, Pause, Play, RotateCcw, Save, Timer, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DAILY_PROMPTS, promptOfTheDay, saveChallenge } from '../logic/play'
import { todayKey } from '../logic/stats'
import { newId } from '../model/universe'
import { wordCount } from '../persistence/repository'
import { recall, remember } from '../state/prefs'
import { celebrate } from '../ui/Confetti'
import { useBackLayer } from '../ui/useBackLayer'
import {
  addTreino,
  attemptsOf,
  charCount,
  measure,
  MINUTE_CHOICES,
  pace,
  PRESETS,
  recordOf,
  scoreOf,
  treinos,
  unitLabel,
  type Treino,
  type TreinoSetup,
  type TreinoUnit,
} from './treino'

/** O que abre o treino: a proposta e, ao refazer, o mesmo tempo e o mesmo mínimo. */
export interface TreinoStart {
  prompt: string
  daily: boolean
  setup?: TreinoSetup
}

const DRAFT = 'treino-em-andamento'

interface Draft {
  prompt: string
  daily: boolean
  setup: TreinoSetup
  text: string
  /** Milissegundos já escritos (o relógio para quando a página fecha). */
  elapsed: number
  id: string
}

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(recall(DRAFT) ?? 'null') as Draft | null
    return d && typeof d.text === 'string' && d.setup ? d : null
  } catch {
    return null
  }
}

export const hasDraft = () => readDraft() !== null

function lastSetup(): TreinoSetup {
  try {
    const s = JSON.parse(recall('treino-ajuste') ?? 'null') as TreinoSetup | null
    if (s && typeof s.minutes === 'number' && typeof s.target === 'number' && (s.unit === 'palavras' || s.unit === 'caracteres')) return s
  } catch {
    // Sem ajuste guardado: o sprint padrão.
  }
  return PRESETS[1].setup.palavras
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
const minutesLabel = (m: number) => (m === 0 ? 'Sem tempo' : `${m} min`)
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/**
 * O treino de escrita em tela cheia: escolher o desafio, escrever contra o relógio até
 * passar do mínimo e ver o resultado. Cada tentativa fica guardada (e vai para a nuvem).
 */
export function TreinoPage({
  start,
  onClose,
  onSaved,
  onKeepScene,
  onHistory,
}: {
  start?: TreinoStart
  onClose: () => void
  /** Avisa que um treino foi guardado (para subir para a nuvem). */
  onSaved: (t: Treino) => void
  /** Dentro de um universo: transforma o texto numa cena. */
  onKeepScene?: (t: Treino) => void
  onHistory?: () => void
}) {
  const draft = useMemo(readDraft, [])
  const [phase, setPhase] = useState<'preparar' | 'escrevendo' | 'resumo'>(draft ? 'escrevendo' : 'preparar')
  const [prompt, setPrompt] = useState(draft?.prompt ?? start?.prompt ?? promptOfTheDay())
  const [daily, setDaily] = useState(draft?.daily ?? start?.daily ?? true)
  const [setup, setSetup] = useState<TreinoSetup>(draft?.setup ?? start?.setup ?? lastSetup())
  const [text, setText] = useState(draft?.text ?? '')
  const [elapsed, setElapsed] = useState(draft?.elapsed ?? 0)
  const [paused, setPaused] = useState(Boolean(draft))
  const [result, setResult] = useState<{ treino: Treino | null; record: boolean; before: number } | null>(null)
  const [kept, setKept] = useState(false)
  const id = useRef(draft?.id ?? newId())
  const since = useRef<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const metAt = useRef(false)

  useBackLayer(onClose)
  // A página de trás não rola junto (no celular, o dedo escorrega para ela).
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [])
  // Esc fecha ao escolher ou ao ver o resultado; escrevendo, não (para não perder o embalo sem querer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'escrevendo' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [phase, onClose])

  const limit = setup.minutes * 60_000
  const left = limit - elapsed
  const score = measure(text, setup.unit)
  const met = setup.target > 0 && score >= setup.target

  // O relógio: conta só enquanto escreve e não está em pausa.
  useEffect(() => {
    if (phase !== 'escrevendo' || paused) {
      since.current = null
      return
    }
    since.current = Date.now()
    const t = setInterval(() => {
      const now = Date.now()
      const step = now - (since.current ?? now)
      since.current = now
      setElapsed((e) => e + step)
    }, 250)
    return () => clearInterval(t)
  }, [phase, paused])

  // Guarda o rascunho a cada mudança: se o celular fechar o app, o treino continua de onde parou.
  useEffect(() => {
    if (phase !== 'escrevendo') return
    remember(DRAFT, JSON.stringify({ prompt, daily, setup, text, elapsed: Math.round(elapsed / 1000) * 1000, id: id.current } satisfies Draft))
  }, [phase, prompt, daily, setup, text, elapsed])

  // Bateu o mínimo: uma comemoração pequena, e segue escrevendo.
  useEffect(() => {
    if (phase === 'escrevendo' && met && !metAt.current) {
      metAt.current = true
      celebrate()
    }
  }, [phase, met])

  const finish = () => {
    remember(DRAFT, null)
    setPaused(true)
    const body = text.trim()
    if (!body) {
      setResult({ treino: null, record: false, before: 0 })
      setPhase('resumo')
      return
    }
    const seconds = Math.round((limit > 0 ? Math.min(elapsed, limit) : elapsed) / 1000)
    const prev = recordOf(treinos(), { prompt, unit: setup.unit, minutes: setup.minutes })
    const t: Treino = {
      id: id.current,
      day: todayKey(),
      prompt,
      daily,
      minutes: setup.minutes,
      target: setup.target,
      unit: setup.unit,
      words: wordCount(body),
      chars: charCount(body),
      seconds,
      done: setup.target === 0 || measure(body, setup.unit) >= setup.target,
      text: body,
      at: new Date().toISOString(),
    }
    addTreino(t)
    // A proposta do dia, feita: conta como o desafio do dia (e para as medalhas).
    if (t.daily && t.done && t.prompt === promptOfTheDay(t.day)) saveChallenge(t.day, { treinoId: t.id, done: true })
    onSaved(t)
    setResult({ treino: t, record: Boolean(prev) && scoreOf(t) > scoreOf(prev!), before: prev ? scoreOf(prev) : 0 })
    setPhase('resumo')
  }

  // Acabou o tempo: termina sozinho.
  useEffect(() => {
    if (phase === 'escrevendo' && limit > 0 && elapsed >= limit) finish()
    // `finish` muda a cada letra; o que importa é o relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, limit, elapsed])

  const begin = (s: TreinoSetup) => {
    remember('treino-ajuste', JSON.stringify(s))
    setSetup(s)
    setText('')
    setElapsed(0)
    setPaused(false)
    setResult(null)
    setKept(false)
    metAt.current = false
    id.current = newId()
    setPhase('escrevendo')
    requestAnimationFrame(() => area.current?.focus())
  }

  const otherPrompt = () => {
    const pool = DAILY_PROMPTS.filter((p) => p !== prompt)
    setPrompt(pool[Math.floor(Math.random() * pool.length)])
    setDaily(false)
  }

  const record = recordOf(treinos(), { prompt, unit: setup.unit, minutes: setup.minutes })
  const tries = attemptsOf(treinos(), { prompt, unit: setup.unit })

  return createPortal(
    <div className={`treino-page treino-${phase}`} role="dialog" aria-modal="true" aria-label="Treino de escrita">
      <header className="treino-top">
        {phase === 'escrevendo' ? (
          <>
            <button
              type="button"
              className={`treino-clock${limit > 0 && left <= 60_000 ? ' is-ending' : ''}`}
              aria-label={paused ? 'Continuar o relógio' : 'Pausar o relógio'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              <span className="tabular" role="timer" aria-live="off">
                {limit > 0 ? clock(left) : clock(elapsed)}
              </span>
            </button>
            {limit > 0 && (
              <span className="treino-time-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (elapsed / limit) * 100)}%` }} />
              </span>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={finish}>
              <Flag size={15} /> Terminar
            </button>
          </>
        ) : (
          <>
            <span className="treino-brand">
              <Timer size={18} aria-hidden="true" /> Treino de escrita
            </span>
            <button type="button" className="btn-icon" aria-label="Fechar o treino" onClick={onClose}>
              <X size={18} />
            </button>
          </>
        )}
      </header>

      {phase === 'preparar' && (
        <div className="treino-scroll">
          <section className="treino-prompt-card">
            <p className="treino-kicker">{daily ? `Desafio de hoje · ${dateFmt.format(new Date())}` : 'Desafio'}</p>
            <p className="treino-prompt">{prompt}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={otherPrompt}>
              <Dices size={15} /> Outra proposta
            </button>
          </section>

          <h2 className="treino-h">Escolha o treino</h2>
          <div className="segmented treino-units" role="radiogroup" aria-label="Contar em">
            {(['palavras', 'caracteres'] as TreinoUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={setup.unit === u}
                onClick={() => {
                  const preset = PRESETS.find((p) => p.setup[setup.unit].minutes === setup.minutes && p.setup[setup.unit].target === setup.target)
                  setSetup(preset ? preset.setup[u] : { ...setup, unit: u, target: u === 'caracteres' ? setup.target * 6 : Math.round(setup.target / 6) })
                }}
              >
                {u === 'palavras' ? 'Palavras' : 'Caracteres'}
              </button>
            ))}
          </div>
          <div className="treino-presets">
            {PRESETS.map((p) => {
              const s = p.setup[setup.unit]
              const on = s.minutes === setup.minutes && s.target === setup.target
              return (
                <button key={p.id} type="button" className={`treino-preset${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setSetup(s)}>
                  <strong>{p.name}</strong>
                  <span>
                    {s.minutes} min · {s.target.toLocaleString('pt-BR')} {unitLabel(s.unit, s.target)}
                  </span>
                  <span className="muted tiny">{p.hint}</span>
                </button>
              )
            })}
          </div>

          <details className="treino-custom">
            <summary>Do meu jeito</summary>
            <p className="treino-label" id="treino-tempo">
              Tempo
            </p>
            <div className="treino-chips" role="radiogroup" aria-labelledby="treino-tempo">
              {MINUTE_CHOICES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={setup.minutes === m} className="start-chip" onClick={() => setSetup({ ...setup, minutes: m })}>
                  {minutesLabel(m)}
                </button>
              ))}
            </div>
            <label className="treino-label" htmlFor="treino-minimo">
              Mínimo de {unitLabel(setup.unit, 2)}
            </label>
            <input
              id="treino-minimo"
              className="input treino-target"
              inputMode="numeric"
              value={setup.target || ''}
              placeholder="0 = sem mínimo"
              onChange={(e) => setSetup({ ...setup, target: Math.min(100_000, Math.max(0, Math.trunc(Number(e.target.value.replace(/\D/g, '')) || 0))) })}
            />
          </details>

          {record && (
            <p className="treino-record">
              <Trophy size={15} aria-hidden="true" /> Seu recorde neste desafio: {scoreOf(record).toLocaleString('pt-BR')} {unitLabel(record.unit, scoreOf(record))} em {minutesLabel(record.minutes).toLowerCase()} ({tries.length}{' '}
              {tries.length === 1 ? 'tentativa' : 'tentativas'})
            </p>
          )}

          <button type="button" className="btn btn-primary btn-lg treino-go" onClick={() => begin(setup)}>
            <Play size={18} /> Começar · {minutesLabel(setup.minutes)}
            {setup.target > 0 && ` · ${setup.target.toLocaleString('pt-BR')} ${unitLabel(setup.unit, setup.target)}`}
          </button>
          {onHistory && (
            <button type="button" className="btn btn-ghost btn-sm treino-history-link" onClick={onHistory}>
              Ver seus treinos
            </button>
          )}
        </div>
      )}

      {phase === 'escrevendo' && (
        <div className="treino-write">
          <details className="treino-prompt-mini">
            <summary>{prompt}</summary>
          </details>
          {paused && (
            <p className="treino-paused" role="status">
              Relógio parado. Toque no tempo para continuar.
            </p>
          )}
          <textarea
            ref={area}
            className="treino-area"
            aria-label="Texto do treino"
            placeholder="Escreva sem parar. Corrigir fica para depois."
            value={text}
            autoFocus={!paused}
            onChange={(e) => {
              setText(e.target.value)
              if (paused && phase === 'escrevendo') setPaused(false)
            }}
          />
          <footer className="treino-count" aria-live="polite">
            {setup.target > 0 && (
              <span className={`treino-count-bar${met ? ' is-met' : ''}`} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (score / setup.target) * 100)}%` }} />
              </span>
            )}
            <span className="treino-count-text">
              {met ? <Check size={15} aria-hidden="true" /> : null}
              <strong className="tabular">{score.toLocaleString('pt-BR')}</strong>
              {setup.target > 0 ? ` de ${setup.target.toLocaleString('pt-BR')}` : ''} {unitLabel(setup.unit, setup.target || score)}
              {met && ' · mínimo batido!'}
              <span className="muted">
                {' '}
                · {setup.unit === 'palavras' ? `${charCount(text).toLocaleString('pt-BR')} caracteres` : `${wordCount(text).toLocaleString('pt-BR')} palavras`}
              </span>
            </span>
          </footer>
        </div>
      )}

      {phase === 'resumo' && result && (
        <div className="treino-scroll treino-result">
          {result.treino ? (
            <>
              <p className={`treino-verdict${result.treino.done ? ' is-done' : ''}`}>
                {result.treino.done ? <Check size={22} aria-hidden="true" /> : <Flag size={22} aria-hidden="true" />}
                {result.treino.done
                  ? 'Mínimo batido!'
                  : `Faltaram ${(result.treino.target - scoreOf(result.treino)).toLocaleString('pt-BR')} ${unitLabel(result.treino.unit, result.treino.target - scoreOf(result.treino))}`}
              </p>
              {result.record && (
                <p className="treino-new-record">
                  <Trophy size={16} aria-hidden="true" /> Novo recorde neste desafio (antes: {result.before.toLocaleString('pt-BR')})
                </p>
              )}
              <dl className="treino-stats">
                <div>
                  <dt>Palavras</dt>
                  <dd className="tabular">{result.treino.words.toLocaleString('pt-BR')}</dd>
                </div>
                <div>
                  <dt>Caracteres</dt>
                  <dd className="tabular">{result.treino.chars.toLocaleString('pt-BR')}</dd>
                </div>
                <div>
                  <dt>Tempo</dt>
                  <dd className="tabular">{clock(result.treino.seconds * 1000)}</dd>
                </div>
                <div>
                  <dt>Ritmo</dt>
                  <dd className="tabular">{result.treino.seconds >= 30 ? `${pace(result.treino)} pal./min` : '—'}</dd>
                </div>
              </dl>
              <p className="muted small">Guardado nos seus treinos. Dá para refazer este desafio quando quiser e comparar.</p>
            </>
          ) : (
            <p className="treino-verdict">Nada escrito, nada guardado.</p>
          )}
          <div className="treino-result-actions">
            <button type="button" className="btn btn-primary" onClick={() => begin(setup)}>
              <RotateCcw size={16} /> Refazer este desafio
            </button>
            {result.treino && onKeepScene && (
              <button
                type="button"
                className="btn"
                disabled={kept}
                onClick={() => {
                  onKeepScene(result.treino!)
                  setKept(true)
                }}
              >
                {kept ? <Check size={16} /> : <Save size={16} />} {kept ? 'Virou uma cena' : 'Guardar como cena'}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('preparar')}>
              <ArrowLeft size={16} /> Outro treino
            </button>
            {onHistory && (
              <button type="button" className="btn btn-ghost" onClick={onHistory}>
                Ver seus treinos
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
