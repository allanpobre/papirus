import { ArrowLeft, ArrowRight, Check, Dices, ImagePlus, Link2, Loader2, Sparkles, X } from 'lucide-react'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { birthQuestions, sparkFor, tieSuggestions, tieTypes } from '../logic/birth'
import { answer, answerOf } from '../logic/kindQuestions'
import { Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { draftRelation, insert, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'
import { RefsStrip } from './ReferencesView'

/*
 * O nascimento de uma ficha: em vez de um formulário, cartas na cor do tipo. Rosto (retrato, uma linha e as
 * referências), Faísca (uma pergunta por carta, com um dado que sorteia do próprio mundo) e Lugar no mundo
 * (um toque liga a ficha a outras). No fim, a carta vira: a ficha pronta, com as primeiras ligações.
 */

type Tie = { toId: string; type: string }

export function BirthFlow({ entity: e, onDone }: { entity: Entity; onDone: () => void }) {
  const { universe, update, toast } = useWorkspace()
  const questions = useMemo(() => birthQuestions(e.kind), [e.kind])
  const suggestions = useMemo(() => tieSuggestions(universe, e), [universe, e])
  // Cartas: 0 rosto, 1..n perguntas, n+1 ligações, n+2 a carta pronta.
  const last = questions.length + 2
  const [step, setStep] = useState(0)
  const [ties, setTies] = useState<Tie[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const set = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', e.id, changes))
  const picker = useImagePicker('retrato', (ref) => set({ image: ref }), (m) => toast(m, { tone: 'erro' }))
  const touch = useRef<number | null>(null)
  const color = { '--birth': `var(--kind-${e.kind}, var(--accent))` } as CSSProperties

  const finish = () => {
    if (ties.length)
      update((u) => ties.reduce((acc, t) => insert(acc, 'relations', draftRelation(e.id, t.toId, t.type))[0], u))
    setStep(last)
  }
  const next = () => (step === last - 1 ? finish() : setStep((s) => Math.min(last, s + 1)))
  const back = () => setStep((s) => Math.max(0, s - 1))
  const toggleTie = (toId: string, type: string) =>
    setTies((list) => (list.some((t) => t.toId === toId && t.type === type) ? list.filter((t) => !(t.toId === toId && t.type === type)) : [...list.filter((t) => t.toId !== toId), { toId, type }]))
  const nameOf = (id: string) => universe.entities.find((x) => x.id === id)?.name ?? ''
  const q = step >= 1 && step <= questions.length ? questions[step - 1] : null

  return (
    <Modal title={`Nascimento: ${e.name || 'nova ficha'}`} onClose={onDone} size="md" help="nascimento">
      <div
        className="birth"
        style={color}
        onTouchStart={(ev) => (touch.current = ev.touches[0].clientX)}
        onTouchEnd={(ev) => {
          if (touch.current === null || step === last) return
          const dx = ev.changedTouches[0].clientX - touch.current
          touch.current = null
          // Deslizar entre cartas (só um gesto largo, para não brigar com rolar ou digitar).
          if (dx < -70) next()
          else if (dx > 70) back()
        }}
      >
        {step < last && <ol className="birth-dots" aria-label={`Carta ${Math.min(step + 1, last)} de ${last}`}>
          {Array.from({ length: last }, (_, i) => (
            <li key={i} className={i === step ? 'is-now' : i < step ? 'is-done' : undefined} />
          ))}
        </ol>}

        {step === 0 && (
          <section className="birth-card birth-face" aria-label="Rosto">
            <p className="birth-kind">{kindLabel(e.kind)}</p>
            {picker.field}
            <button type="button" className="birth-portrait" onClick={picker.open} disabled={picker.busy} aria-label={e.image ? 'Trocar o retrato' : 'Pôr um retrato'}>
              {e.image ? <Picture value={e.image} alt={`Retrato de ${e.name}`} /> : picker.busy ? <Loader2 size={28} className="spin" /> : (
                <>
                  <span className="birth-initial" aria-hidden="true">{(e.name.trim()[0] ?? '?').toUpperCase()}</span>
                  <span className="birth-portrait-hint">
                    <ImagePlus size={14} aria-hidden="true" /> retrato
                  </span>
                </>
              )}
            </button>
            <input className="birth-name" aria-label="Nome" value={e.name} onChange={(ev) => set({ name: ev.target.value })} />
            <input className="input birth-line" aria-label="Em uma linha" placeholder={`Em uma linha, quem é ${e.name || 'esta ficha'}?`} value={e.summary} onChange={(ev) => set({ summary: ev.target.value })} />
            <RefsStrip entity={e} />
          </section>
        )}

        {q && (
          <section className="birth-card birth-spark" aria-label="Faísca">
            <p className="birth-kind">
              <Sparkles size={14} aria-hidden="true" /> Faísca {step} de {questions.length}
            </p>
            <h3 className="birth-ask">{q.ask}</h3>
            <textarea
              key={q.key}
              className="input birth-answer"
              aria-label={q.ask}
              rows={3}
              autoFocus
              placeholder={q.example}
              value={answerOf(e.fields, q.key)}
              onChange={(ev) => set({ fields: answer(e.fields, q.key, ev.target.value) })}
            />
            <button type="button" className="btn birth-dice" onClick={() => set({ fields: answer(e.fields, q.key, sparkFor(q, universe, e.id)) })}>
              <Dices size={16} aria-hidden="true" /> Sortear do meu mundo
            </button>
          </section>
        )}

        {step === questions.length + 1 && (
          <section className="birth-card birth-world" aria-label="Lugar no mundo">
            <p className="birth-kind">
              <Link2 size={14} aria-hidden="true" /> Lugar no mundo
            </p>
            <h3 className="birth-ask">Com quem ou com o quê {e.name || 'esta ficha'} se liga?</h3>
            {suggestions.length ? (
              <ul className="birth-ties" aria-label="Fichas para ligar">
                {suggestions.map((o) => {
                  const chosen = ties.find((t) => t.toId === o.id)
                  return (
                    <li key={o.id}>
                      <button type="button" className={`chip birth-tie kind-${o.kind}`} aria-pressed={!!chosen} aria-expanded={picking === o.id} onClick={() => setPicking(picking === o.id ? null : o.id)}>
                        {chosen ? `${chosen.type} ${o.name}` : o.name}
                      </button>
                      {picking === o.id && (
                        <span className="birth-tie-types" role="group" aria-label={`Como se liga a ${o.name}`}>
                          {tieTypes(e.kind, o.kind).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="chip chip-sm"
                              aria-pressed={chosen?.type === t}
                              onClick={() => {
                                toggleTie(o.id, t)
                                setPicking(null)
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted">Ainda não há outras fichas. As ligações podem vir depois.</p>
            )}
          </section>
        )}

        {step === last && (
          <section className="birth-card birth-done" aria-label="Nasceu">
            <div className="birth-done-face">
              {e.image ? <Picture value={e.image} alt="" className="birth-done-img" /> : <span className="birth-initial" aria-hidden="true">{(e.name.trim()[0] ?? '?').toUpperCase()}</span>}
            </div>
            <p className="birth-kind">{kindLabel(e.kind)}</p>
            <h3 className="birth-done-name">{e.name}</h3>
            {e.summary && <p className="birth-done-line">{e.summary}</p>}
            <ul className="birth-done-sparks">
              {questions
                .filter((x) => answerOf(e.fields, x.key).trim())
                .map((x) => (
                  <li key={x.key}>
                    <span className="birth-done-key">{x.key}</span> {answerOf(e.fields, x.key)}
                  </li>
                ))}
            </ul>
            {ties.length > 0 && (
              <p className="birth-done-ties">
                {ties.map((t) => `${t.type} ${nameOf(t.toId)}`).join(' · ')}
              </p>
            )}
            <button type="button" className="btn btn-primary birth-open" onClick={onDone}>
              <Check size={16} aria-hidden="true" /> Ver a ficha
            </button>
          </section>
        )}

        {step < last && (
          <div className="birth-nav">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={back}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={onDone}>
                <X size={16} aria-hidden="true" /> Pular
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={next}>
              {step === last - 1 ? (
                <>
                  <Sparkles size={16} aria-hidden="true" /> Dar vida
                </>
              ) : (
                <>
                  Próxima <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
