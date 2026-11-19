import { Languages, Plus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { optionKinds } from '../logic/definers'
import { addSoundCard, hasLanguage, kindNames, parseSyllables, SOUND_CARDS, translate, wordFor, type NameKind } from '../logic/language'
import { fold } from '../logic/text'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Field } from '../ui/bits'
import { Fold } from '../ui/Fold'

const KIND_LABEL: Record<NameKind, string> = { pessoa: 'Pessoas', lugar: 'Lugares', familia: 'Famílias' }

/**
 * Língua de um povo ou cultura (e de qualquer opção do "Quem é"): cartas de som que viram sílabas, nomes de pessoa,
 * lugar e família, um mini dicionário e uma frase traduzida palavra a palavra. Tudo por regras, sem IA.
 * O "Sugerir nomes" e o "Rolar no mundo" usam esta língua. Fecha por padrão, a não ser que já tenha uma.
 */
export function LanguageEditor({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const [text, setText] = useState((e.language?.syllables ?? []).join(' '))
  const [tries, setTries] = useState<Partial<Record<NameKind, string[]>>>({})
  const [meaning, setMeaning] = useState('')
  const [word, setWord] = useState('')
  const [phrase, setPhrase] = useState('')
  if (!['cultura', ...optionKinds(universe)].includes(e.kind)) return null
  const lang = e.language ?? { syllables: [], sounds: '', example: '' }
  const set = (next: typeof lang) => update((u) => patch(u, 'entities', e.id, { language: next }))
  const ready = hasLanguage({ language: lang })
  const words = lang.words ?? []
  const avoid = universe.entities.map((x) => x.name)
  const addWords = (list: { word: string; meaning: string }[]) => {
    const fresh = list.filter((w) => w.word && w.meaning && !words.some((x) => fold(x.meaning) === fold(w.meaning)))
    if (fresh.length) set({ ...lang, words: [...words, ...fresh].sort((a, b) => a.meaning.localeCompare(b.meaning, 'pt-BR')) })
  }
  const translated = ready && phrase.trim() ? translate(lang, phrase) : []
  const newOnes = translated.filter((t) => !t.known)
  return (
    <div className="language-editor">
      <Fold id="ficha-idioma" title="Língua" defaultOpen={Boolean(e.language)}>
        <p className="muted small">
          <Languages size={14} aria-hidden="true" /> Como este povo fala. Os nomes sugeridos no app (“Sugerir nomes”, “Rolar no mundo”) saem nesta língua.
        </p>

        <h4 className="lang-h">1. Como soa</h4>
        <div className="lang-cards" role="group" aria-label="Cartas de som">
          {SOUND_CARDS.map((c) => {
            const on = c.syllables.every((s) => lang.syllables.includes(s))
            return (
              <button
                key={c.id}
                type="button"
                className="lang-card"
                aria-pressed={on}
                disabled={on}
                onClick={() => {
                  const syllables = addSoundCard(lang.syllables, c.id)
                  setText(syllables.join(' '))
                  set({ ...lang, syllables, sounds: lang.sounds || c.hint.split(':')[0] })
                }}
              >
                <strong>{c.name}</strong>
                <span>{c.hint}</span>
              </button>
            )
          })}
        </div>
        <Field label="Sílabas" wide hint="As cartas juntam sílabas aqui; dá para mudar à mão. “kar-” só abre um nome e “-dor” só o fecha.">
          {(id) => (
            <textarea
              id={id}
              className="input textarea"
              rows={2}
              placeholder="kar- vel- ul en thor -dor -ath"
              value={text}
              onChange={(ev) => {
                setText(ev.target.value)
                set({ ...lang, syllables: parseSyllables(ev.target.value) })
              }}
            />
          )}
        </Field>
        <Field label="Em palavras" wide>
          {(id) => <input id={id} className="input" placeholder="duro, cheio de k e r" value={lang.sounds} onChange={(ev) => set({ ...lang, sounds: ev.target.value })} />}
        </Field>

        <h4 className="lang-h">2. Nomes</h4>
        <div className="inline-fields">
          <Field label="Fim de lugar" hint="“-heim”, “-polis”">
            {(id) => <input id={id} className="input" value={lang.placeEnding ?? ''} onChange={(ev) => set({ ...lang, placeEnding: ev.target.value })} />}
          </Field>
          <Field label="Começo de família" hint="“Mac”, “O'”, “al-”">
            {(id) => <input id={id} className="input" value={lang.familyPrefix ?? ''} onChange={(ev) => set({ ...lang, familyPrefix: ev.target.value })} />}
          </Field>
        </div>
        <div className="row lang-try">
          {(Object.keys(KIND_LABEL) as NameKind[]).map((k) => (
            <button key={k} type="button" className="btn btn-sm" disabled={!ready} onClick={() => setTries((t) => ({ ...t, [k]: kindNames(lang, k, 5, Math.random, avoid) }))}>
              <Sparkles size={13} aria-hidden="true" /> {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {!ready && <p className="muted small">Escolha uma carta de som (ou escreva duas sílabas) para começar.</p>}
        {(Object.keys(tries) as NameKind[]).map((k) => (
          <p key={k} className="language-tries small" aria-label={`Nomes de ${KIND_LABEL[k].toLocaleLowerCase('pt-BR')}`}>
            <strong>{KIND_LABEL[k]}:</strong> {tries[k]!.join(' · ')}
          </p>
        ))}

        <h4 className="lang-h">3. Dicionário</h4>
        {words.length > 0 && (
          <ul className="lang-dict" aria-label="Dicionário">
            {words.map((w) => (
              <li key={w.meaning}>
                <strong lang="x-mundo">{w.word}</strong> <span className="muted">{w.meaning}</span>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Tirar ${w.word}`} onClick={() => set({ ...lang, words: words.filter((x) => x !== w) })}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="lang-add"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!meaning.trim()) return
            addWords([{ meaning: meaning.trim(), word: (word.trim() || wordFor(lang, meaning)).toLocaleLowerCase('pt-BR') }])
            setMeaning('')
            setWord('')
          }}
        >
          <input className="input" aria-label="Quer dizer" placeholder="quer dizer… (rio)" value={meaning} onChange={(ev) => setMeaning(ev.target.value)} />
          <input className="input" aria-label="Palavra na língua" placeholder="palavra" value={word} onChange={(ev) => setWord(ev.target.value)} />
          <button type="button" className="btn btn-sm" disabled={!ready || !meaning.trim()} onClick={() => setWord(wordFor(lang, meaning + (word ? word : '')))}>
            <Sparkles size={13} aria-hidden="true" /> Gerar
          </button>
          <button type="submit" className="btn btn-sm" disabled={!meaning.trim() || (!ready && !word.trim())}>
            <Plus size={13} aria-hidden="true" /> Guardar
          </button>
        </form>

        <h4 className="lang-h">4. Uma frase</h4>
        <Field label="Em português" wide hint="Palavra a palavra: o que está no dicionário vale; o resto ganha uma sugestão.">
          {(id) => <input id={id} className="input" placeholder="O rio guarda os mortos" value={phrase} disabled={!ready} onChange={(ev) => setPhrase(ev.target.value)} />}
        </Field>
        {translated.length > 0 && (
          <div className="lang-phrase" aria-label="Frase traduzida">
            {translated.map((t, i) =>
              t.word ? (
                <span key={i} className={`lang-w${t.known ? '' : ' is-new'}`}>
                  <strong>{t.word}</strong>
                  <small>{t.pt}</small>
                </span>
              ) : null,
            )}
          </div>
        )}
        {newOnes.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => addWords(newOnes.map((t) => ({ word: t.word, meaning: t.pt.toLocaleLowerCase('pt-BR') })))}>
            <Plus size={13} aria-hidden="true" /> {newOnes.length === 1 ? 'Guardar a palavra nova' : `Guardar as ${newOnes.length} palavras novas`}
          </button>
        )}
        <Field label="Um exemplo para lembrar" wide>
          {(id) => <textarea id={id} className="input textarea" rows={2} placeholder="Karuth ven dor: “o rio é largo”" value={lang.example} onChange={(ev) => set({ ...lang, example: ev.target.value })} />}
        </Field>
      </Fold>
    </div>
  )
}
