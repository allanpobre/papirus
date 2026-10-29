import { ArrowLeft, ArrowRight, Check, EyeOff, Flag, Hand, Pause, Play, RotateCcw, Save, Send, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from '../account/auth'
import { todayKey } from '../logic/stats'
import { newId } from '../model/universe'
import { wordCount } from '../persistence/repository'
import { recall, remember } from '../state/prefs'
import { addTreino, charCount, pace, treinos, type Treino } from '../treino/treino'
import { syncTreinosNow } from '../treino/useTreinoSync'
import { celebrate } from '../ui/Confetti'
import { PageHelp } from '../ui/PageTour'
import { useBackLayer } from '../ui/useBackLayer'
import { LOOK } from './look'
import { completeStep, oficinaProgress } from './progress'
import { dialogueShare, forbiddenIn, menteWords, nearRepeats, sentenceLengths, speechVerbs } from './textCounts'
import { compareImitation, nextStep, segments, setupOf, STEP_KIND_LABEL, stepKey, trailComplete, type Trail, type TrailStep } from './trails'

const DRAFT = 'oficina-passo'
const ANSWERS = ['Sim', 'Quase', 'Não'] as const

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function readDraft(key: string): { text: string; elapsed: number; id: string } | null {
  try {
    const d = JSON.parse(recall(DRAFT) ?? 'null') as { key: string; text: string; elapsed: number; id: string } | null
    return d && d.key === key && typeof d.text === 'string' ? d : null
  } catch {
    return null
  }
}

/**
 * Um passo de uma trilha, em tela cheia: ler a técnica (ou o trecho, na imitação), escrever
 * com o relógio e olhar depois, com as contas do texto e as perguntas. O texto vira um treino
 * (no caderno, na sequência de dias e no placar).
 */
export function StepPage({
  trail,
  step,
  onClose,
  onNext,
  onKeepScene,
  onRoteiro,
}: {
  trail: Trail
  step: TrailStep
  onClose: () => void
  /** Abre outro passo da trilha (o próximo). */
  onNext: (step: TrailStep) => void
  /** Dentro de um universo: o texto vira uma cena. */
  onKeepScene?: (t: Treino) => void
  /** Numa campanha: manda o texto para o Roteiro da próxima sessão e diz qual. */
  onRoteiro?: (kind: 'inicio' | 'cena', text: string) => string | null
}) {
  const key = stepKey(trail.id, step.id)
  const draft = useMemo(() => readDraft(key), [key])
  const imitation = step.kind === 'imitacao'
  const { minutes, target } = imitation ? { minutes: 0, target: step.practice.target ?? 0 } : setupOf(step.practice, trail.guide)
  const [phase, setPhase] = useState<'ler' | 'escrevendo' | 'olhar'>(draft ? 'escrevendo' : 'ler')
  const [text, setText] = useState(draft?.text ?? '')
  const [elapsed, setElapsed] = useState(draft?.elapsed ?? 0)
  const [paused, setPaused] = useState(Boolean(draft))
  const [moving, setMoving] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [saved, setSaved] = useState<Treino | null>(null)
  const [answers, setAnswers] = useState<string[]>(() => step.practice.ask.map(() => ''))
  const [concluded, setConcluded] = useState(false)
  const [kept, setKept] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const id = useRef(draft?.id ?? newId())
  const since = useRef<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const metAt = useRef(false)
  const account = useAccount()
  const { icon: Icon, color } = LOOK[trail.id]
  const position = trail.steps.findIndex((s) => s.id === step.id) + 1

  // O texto de antes, na revisão: o último que esta trilha guardou para o passo revisitado.
  const before = useMemo(() => {
    if (!step.revisits) return null
    const notes = oficinaProgress().notes
    return treinos().find((t) => notes[t.id]?.trail === trail.id && notes[t.id]?.step === step.revisits) ?? null
  }, [step.revisits, trail.id])
  const revisited = step.revisits ? trail.steps.find((s) => s.id === step.revisits) : undefined

  useBackLayer(onClose)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'escrevendo' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [phase, onClose])

  const limit = minutes * 60_000
  const words = wordCount(text)
  const met = target > 0 && words >= target
  const forbidden = forbiddenIn(text, step.practice.forbid ?? [])

  useEffect(() => {
    if (phase !== 'escrevendo' || paused) {
      since.current = null
      return
    }
    since.current = Date.now()
    const t = setInterval(() => {
      const now = Date.now()
      const delta = now - (since.current ?? now)
      since.current = now
      setElapsed((e) => e + delta)
    }, 250)
    return () => clearInterval(t)
  }, [phase, paused])

  useEffect(() => {
    if (phase === 'escrevendo') remember(DRAFT, JSON.stringify({ key, text, elapsed: Math.round(elapsed / 1000) * 1000, id: id.current }))
  }, [phase, key, text, elapsed])

  useEffect(() => {
    if (phase === 'escrevendo' && met && !metAt.current) {
      metAt.current = true
      celebrate()
    }
  }, [phase, met])

  const begin = (keep = false) => {
    if (!keep) setText('')
    setElapsed(0)
    setPaused(false)
    setSaved(null)
    setConcluded(false)
    setKept(false)
    setSent(null)
    metAt.current = false
    id.current = newId()
    setPhase('escrevendo')
    requestAnimationFrame(() => area.current?.focus())
  }

  const finish = () => {
    remember(DRAFT, null)
    setPaused(true)
    const body = text.trim()
    if (!body) {
      setPhase('ler')
      return
    }
    const seconds = Math.round((limit > 0 ? Math.min(elapsed, limit) : elapsed) / 1000)
    const t: Treino = {
      id: id.current,
      day: todayKey(),
      prompt: step.kind === 'imitacao' ? `Imitação: ${step.passage?.source ?? ''}` : step.practice.prompt,
      daily: false,
      minutes,
      target,
      unit: 'palavras',
      words: wordCount(body),
      chars: charCount(body),
      seconds,
      done: target === 0 || wordCount(body) >= target,
      text: body,
      at: new Date().toISOString(),
    }
    addTreino(t)
    syncTreinosNow(account)
    setSaved(t)
    setPhase('olhar')
  }

  useEffect(() => {
    if (phase === 'escrevendo' && limit > 0 && elapsed >= limit) finish()
    // `finish` muda a cada letra; o que importa é o relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, limit, elapsed])

  const comparison = useMemo(() => (imitation && step.passage && saved ? compareImitation(step.passage.text, saved.text) : null), [imitation, step.passage, saved])

  const conclude = () => {
    if (!saved) return
    completeStep(trail.id, step.id, saved.id, answers, comparison ? Math.round(comparison.score * 100) / 100 : undefined)
    setConcluded(true)
    if (trailComplete(oficinaProgress(), trail)) celebrate()
  }
  const next = concluded ? nextStep(oficinaProgress(), trail) : null

  return createPortal(
    <div className={`treino-page step-page step-${phase}`} role="dialog" aria-modal="true" aria-label={`Oficina: ${step.title}`} style={{ '--g': color } as React.CSSProperties}>
      <header className="treino-top">
        {phase === 'escrevendo' ? (
          <>
            {limit > 0 ? (
              <>
                <button type="button" className={`treino-clock${left(limit, elapsed) <= 60_000 ? ' is-ending' : ''}`} aria-label={paused ? 'Continuar o relógio' : 'Pausar o relógio'} onClick={() => setPaused(!paused)}>
                  {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                  <span className="tabular" role="timer" aria-live="off">
                    {clock(left(limit, elapsed))}
                  </span>
                </button>
                <span className="treino-time-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (elapsed / limit) * 100)}%` }} />
                </span>
              </>
            ) : (
              <span className="treino-brand">{imitation ? 'De memória' : 'Sem relógio'}</span>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={finish}>
              <Flag size={15} /> {imitation ? 'Comparar' : 'Terminar'}
            </button>
          </>
        ) : (
          <>
            <span className="treino-brand step-brand">
              <Icon size={18} aria-hidden="true" /> {trail.guide.label} · {position} de {trail.steps.length}
            </span>
            <PageHelp tour={phase === 'ler' ? 'oficina-passo' : 'oficina-olhar'} />
            <button type="button" className="btn-icon" aria-label="Fechar o passo" onClick={onClose}>
              <X size={18} />
            </button>
          </>
        )}
      </header>

      {phase === 'ler' && (
        <div className="treino-scroll step-read">
          <p className="treino-kicker">{STEP_KIND_LABEL[step.kind]}</p>
          <h1 className="step-title">{step.title}</h1>
          {imitation && step.passage ? (
            <>
              <p className="step-lesson">{step.text}</p>
              <blockquote className="step-passage">
                <p>{step.passage.text}</p>
                <cite>{step.passage.source}</cite>
              </blockquote>
              <button type="button" className="btn btn-primary btn-lg step-go" onClick={() => begin()}>
                <EyeOff size={18} /> Já li · esconder o trecho
              </button>
            </>
          ) : (
            <>
              <p className="step-lesson">{step.text}</p>
              {step.practice.example && (
                <div className="step-example">
                  <p className="is-tell">
                    <span>Conta</span>
                    {step.practice.example.tell}
                  </p>
                  <p className="is-show">
                    <span>Mostra</span>
                    {step.practice.example.show}
                  </p>
                </div>
              )}
              {step.kind === 'revisao' &&
                (before ? (
                  <details className="step-before">
                    <summary>Seu texto de “{revisited?.title}”</summary>
                    <p>{before.text}</p>
                  </details>
                ) : (
                  <p className="step-before-none small">
                    Você ainda não fez “{revisited?.title}”. Escreva de novo a proposta de lá: {revisited?.practice.prompt}
                  </p>
                ))}
              <section className="treino-prompt-card step-prompt">
                <p className="treino-kicker">O exercício</p>
                <p className="treino-prompt">{step.practice.prompt}</p>
                <p className="muted small">
                  {minutes ? `${minutes} min escrevendo` : 'Sem relógio'}
                  {target > 0 && ` · mínimo de ${target} palavras`}
                  {step.practice.forbid?.length
                    ? ` · sem: ${step.practice.forbid
                        .filter((f) => f.length >= 4 || f.includes(' '))
                        .slice(0, 4)
                        .join(', ')}…`
                    : ''}
                </p>
              </section>
              <label className="step-moving">
                <input type="checkbox" checked={moving} onChange={(e) => setMoving(e.target.checked)} />
                <span>
                  <strong>Mão em movimento</strong>
                  <span className="muted small">Apagar fica desligado até o fim: escreva sem parar e sem corrigir.</span>
                </span>
              </label>
              <button type="button" className="btn btn-primary btn-lg step-go" onClick={() => begin()}>
                <Play size={18} /> Escrever{minutes ? ` · ${minutes} min` : ''}
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'escrevendo' && (
        <div className="treino-write">
          {imitation && step.passage ? (
            <ul className="step-keys" aria-label="Palavras-chave">
              {step.passage.keys.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          ) : (
            <details className="treino-prompt-mini">
              <summary>{step.practice.prompt}</summary>
            </details>
          )}
          {paused && limit > 0 && (
            <p className="treino-paused" role="status">
              Relógio parado. Toque no tempo para continuar.
            </p>
          )}
          <textarea
            ref={area}
            className="treino-area"
            aria-label="Texto do passo"
            placeholder={imitation ? 'Reescreva o trecho como lembrar.' : moving ? 'Escreva sem parar. Apagar fica para depois.' : 'Escreva. Corrigir fica para depois.'}
            value={text}
            autoFocus={!paused}
            onChange={(e) => {
              const value = e.target.value
              // Mão em movimento: o texto só cresce até o fim.
              if (moving && value.length < text.length) {
                setBlocked(true)
                return
              }
              setBlocked(false)
              setText(value)
              if (paused) setPaused(false)
            }}
          />
          <footer className="treino-count" aria-live="polite">
            {target > 0 && (
              <span className={`treino-count-bar${met ? ' is-met' : ''}`} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (words / target) * 100)}%` }} />
              </span>
            )}
            <span className="treino-count-text">
              {met ? <Check size={15} aria-hidden="true" /> : null}
              <strong className="tabular">{words.toLocaleString('pt-BR')}</strong>
              {target > 0 ? ` de ${target}` : ''} {words === 1 ? 'palavra' : 'palavras'}
              {met && ' · mínimo batido!'}
              {moving && (
                <span className={`step-moving-tag${blocked ? ' is-blocked' : ''}`}>
                  <Hand size={13} aria-hidden="true" /> {blocked ? 'Sem apagar até o fim' : 'Mão em movimento'}
                </span>
              )}
            </span>
            {forbidden.length > 0 && (
              <span className="step-forbidden" role="status">
                Fora da regra: {forbidden.map((w) => `“${w}”`).join(', ')}
              </span>
            )}
          </footer>
        </div>
      )}

      {phase === 'olhar' && saved && (
        <div className="treino-scroll step-look">
          <p className="treino-kicker">Olhe o que escreveu</p>
          {comparison && step.passage ? (
            <>
              <p className="step-score">
                <strong className="tabular">{Math.round(comparison.score * 100)}%</strong> das palavras de Machado voltaram no seu texto
              </p>
              <div className="step-compare">
                <section aria-label="O seu texto">
                  <span className="step-compare-label">O seu</span>
                  <p>{segments(saved.text, (w) => w.length >= 4 && comparison.shared.has(w)).map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : s.text))}</p>
                </section>
                <section aria-label="O original">
                  <span className="step-compare-label">Machado</span>
                  <p>
                    {segments(step.passage.text, (w) => w.length >= 4 && comparison.shared.has(w)).map((s, i) =>
                      s.mark ? (
                        <mark key={i}>{s.text}</mark>
                      ) : s.text.length >= 4 && /^\p{L}/u.test(s.text) ? (
                        <span key={i} className="is-gone">
                          {s.text}
                        </span>
                      ) : (
                        s.text
                      ),
                    )}
                  </p>
                </section>
              </div>
              <p className="muted small">Marcadas: as palavras (de 4 letras ou mais) que os dois textos têm. Riscadas de leve: as do original que ficaram de fora.</p>
            </>
          ) : (
            <>
              <p className={`step-target${saved.done ? ' is-met' : ''}`}>
                {saved.done ? <Check size={16} aria-hidden="true" /> : null}
                {target === 0 ? 'Feito.' : saved.done ? `Mínimo de ${target} palavras batido.` : `Faltaram ${target - saved.words} palavras para o mínimo. O passo conta do mesmo jeito.`}
              </p>
              <Counts treino={saved} focus={step.practice.focus ?? []} forbid={step.practice.forbid ?? []} />
            </>
          )}

          <section className="step-ask" aria-label="Perguntas">
            {step.practice.ask.map((q, i) => (
              <div key={q} className={`step-question${openQuestion(q) ? ' is-open' : ''}`}>
                <p id={`pergunta-${i}`}>{q}</p>
                {openQuestion(q) ? (
                  <input className="input" aria-labelledby={`pergunta-${i}`} placeholder="Sua resposta (opcional)" maxLength={200} value={answers[i]} onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))} />
                ) : (
                  <div className="segmented" role="radiogroup" aria-labelledby={`pergunta-${i}`}>
                    {ANSWERS.map((a) => (
                      <button key={a} type="button" role="radio" aria-checked={answers[i] === a} onClick={() => setAnswers(answers.map((x, j) => (j === i ? (x === a ? '' : a) : x)))}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p className="muted tiny">As respostas ficam só no seu caderno. O Papirus não dá nota: quem olha o texto é você.</p>
          </section>

          {concluded ? (
            <div className="step-done" role="status">
              <p className="treino-verdict is-done">
                <Check size={22} aria-hidden="true" /> {trailComplete(oficinaProgress(), trail) ? `Trilha de ${trail.guide.label} completa!` : 'Passo concluído'}
              </p>
              <div className="treino-result-actions">
                {next && (
                  <button type="button" className="btn btn-primary" onClick={() => onNext(next)}>
                    Próximo: {next.title} <ArrowRight size={16} />
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  <ArrowLeft size={16} /> Voltar à Oficina
                </button>
              </div>
            </div>
          ) : (
            <div className="treino-result-actions">
              <button type="button" className="btn btn-primary" onClick={conclude}>
                <Check size={16} /> Concluir o passo
              </button>
              <button type="button" className="btn" onClick={() => begin(true)}>
                <RotateCcw size={16} /> Reescrever
              </button>
            </div>
          )}
          <div className="treino-result-actions">
            {step.practice.mesa && onRoteiro && (
              <button type="button" className="btn btn-ghost" disabled={sent !== null} onClick={() => setSent(onRoteiro(step.practice.mesa!, saved.text) ?? '')}>
                {sent !== null ? <Check size={16} /> : <Send size={16} />} {sent ? `No Roteiro da ${sent}` : step.practice.mesa === 'inicio' ? 'Mandar como início forte' : 'Mandar como cena do Roteiro'}
              </button>
            )}
            {onKeepScene && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={kept}
                onClick={() => {
                  onKeepScene(saved)
                  setKept(true)
                }}
              >
                {kept ? <Check size={16} /> : <Save size={16} />} {kept ? 'Virou uma cena' : 'Guardar como cena'}
              </button>
            )}
          </div>
          <p className="muted small">
            Guardado no caderno: {saved.words.toLocaleString('pt-BR')} palavras{saved.seconds >= 30 ? ` em ${clock(saved.seconds * 1000)} (${pace(saved)} por minuto)` : ''}.
          </p>
        </div>
      )}
    </div>,
    document.body,
  )
}

const left = (limit: number, elapsed: number) => limit - elapsed

/** Pergunta aberta ("Qual gesto…?") pede uma resposta escrita; as outras, sim, quase ou não. */
const openQuestion = (q: string) => /^(qual|quais|o que|onde|quem|como|por que|que |em quais|escolha|se fosse)/i.test(q)

/** As contas do texto: o que dá para medir sem ler por você. */
function Counts({ treino, focus, forbid }: { treino: Treino; focus: string[]; forbid: string[] }) {
  const text = treino.text
  const lengths = sentenceLengths(text)
  const max = Math.max(1, ...lengths)
  const hits = forbiddenIn(text, forbid)
  const verbs = speechVerbs(text)
  const mente = menteWords(text)
  const repeats = nearRepeats(text)
  return (
    <section className="step-counts" aria-label="As contas do texto">
      <dl className="treino-stats">
        <div>
          <dt>Palavras</dt>
          <dd className="tabular">{treino.words.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Frases</dt>
          <dd className="tabular">{lengths.length}</dd>
        </div>
        {forbid.length > 0 && (
          <div className={hits.length ? 'is-off' : 'is-ok'}>
            <dt>Fora da regra</dt>
            <dd className="tabular">{hits.length}</dd>
          </div>
        )}
        {focus.includes('dialogo') && (
          <div>
            <dt>Em fala</dt>
            <dd className="tabular">{Math.round(dialogueShare(text) * 100)}%</dd>
          </div>
        )}
      </dl>
      {hits.length > 0 && <p className="small step-forbidden">Fora da regra: {hits.map((w) => `“${w}”`).join(', ')}. Troque por um gesto ou uma ação.</p>}
      {(focus.includes('frases') || lengths.length >= 3) && lengths.length > 0 && (
        <figure className="step-sentences">
          <figcaption className="small">
            O tamanho das frases: de {Math.min(...lengths)} a {max} palavras
          </figcaption>
          <div className="step-bars" role="img" aria-label={`Frases com ${lengths.join(', ')} palavras, na ordem`}>
            {lengths.map((n, i) => (
              <span key={i} className={n === max ? 'is-max' : undefined} style={{ height: `${Math.max(6, (n / max) * 100)}%` }} />
            ))}
          </div>
        </figure>
      )}
      {focus.includes('falas') && <p className="small">Verbos de fala: {verbs.length ? verbs.map((v) => `${v.verb} (${v.n})`).join(', ') : 'nenhum'}.</p>}
      {focus.includes('mente') && <p className="small">Advérbios em -mente: {mente.length ? mente.join(', ') : 'nenhum'}.</p>}
      {focus.includes('repeticoes') && <p className="small">Palavras repetidas de perto: {repeats.length ? repeats.join(', ') : 'nenhuma'}.</p>}
    </section>
  )
}
