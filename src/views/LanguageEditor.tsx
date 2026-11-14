import { Languages } from 'lucide-react'
import { useState } from 'react'
import { optionKinds } from '../logic/definers'
import { hasLanguage, languageNames, parseSyllables } from '../logic/language'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Field } from '../ui/bits'
import { Fold } from '../ui/Fold'

/**
 * "Idioma" de um povo ou cultura (e de qualquer opção do "Quem é"): as sílabas, como soa e um exemplo.
 * O "Sugerir nomes" usa as sílabas para criar nomes no estilo dele. Fecha por padrão, a não ser que já tenha idioma.
 */
export function LanguageEditor({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const [text, setText] = useState((e.language?.syllables ?? []).join(' '))
  const [tries, setTries] = useState<string[]>([])
  if (!['cultura', ...optionKinds(universe)].includes(e.kind)) return null
  const lang = e.language ?? { syllables: [], sounds: '', example: '' }
  const set = (next: typeof lang) => update((u) => patch(u, 'entities', e.id, { language: next }))
  return (
    <div className="language-editor">
      <Fold id="ficha-idioma" title="Idioma" defaultOpen={Boolean(e.language)}>
        <p className="muted small">
          <Languages size={14} aria-hidden="true" /> As sílabas deste povo. Ao criar uma ficha, “Sugerir nomes” pode montar nomes no estilo dele.
        </p>
        <Field label="Sílabas" wide hint="Separe por espaço ou vírgula. “kar-” só abre um nome e “-dor” só o fecha.">
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
        <Field label="Como soa" wide>
          {(id) => <input id={id} className="input" placeholder="duro, cheio de k e r" value={lang.sounds} onChange={(ev) => set({ ...lang, sounds: ev.target.value })} />}
        </Field>
        <Field label="Um exemplo" wide hint="Uma frase ou algumas palavras no idioma, para não esquecer como é.">
          {(id) => <textarea id={id} className="input textarea" rows={2} placeholder="Karuth ven dor: “o rio é largo”" value={lang.example} onChange={(ev) => set({ ...lang, example: ev.target.value })} />}
        </Field>
        <div className="inline-fields">
          <button
            type="button"
            className="btn btn-sm"
            disabled={!hasLanguage({ language: lang })}
            onClick={() =>
              setTries(
                languageNames(
                  lang,
                  6,
                  Math.random,
                  universe.entities.map((x) => x.name),
                ),
              )
            }
          >
            Testar: sugerir nomes
          </button>
          {!hasLanguage({ language: lang }) && <span className="muted small">Precisa de pelo menos duas sílabas.</span>}
        </div>
        {tries.length > 0 && (
          <p className="language-tries small" aria-label="Nomes de teste">
            {tries.join(' · ')}
          </p>
        )}
      </Fold>
    </div>
  )
}
