import { Check, Lightbulb, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { choose, definersOf } from '../../logic/definers'
import { sceneSuggestions, type Suggestion } from '../../logic/suggestions'
import { entityName, patch } from '../../model/universe'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'

const KEY = 'sugestoes-ignoradas'
const readIgnored = (): string[] => {
  try {
    const v = JSON.parse(recall(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Sugestões do texto da cena, na margem: aceitar ou "agora não". Nada muda sozinho. */
export function SuggestionsSection({ text }: { text: string }) {
  const { universe, update, toast, peek } = useWorkspace()
  const [ignored, setIgnored] = useState(readIgnored)
  const list = useMemo(() => sceneSuggestions(universe, text, ignored), [universe, text, ignored])
  if (!list.length) return null
  const skip = (s: Suggestion) => {
    const next = [...ignored, s.key].slice(-300)
    setIgnored(next)
    remember(KEY, JSON.stringify(next))
  }
  const accept = (s: Suggestion) => {
    if (s.kind === 'apelido') {
      update((u) => {
        const e = u.entities.find((x) => x.id === s.entityId)
        return e && !e.aliases.includes(s.alias) ? patch(u, 'entities', e.id, { aliases: [...e.aliases, s.alias] }) : u
      })
      toast(`“${s.alias}” agora também é ${entityName(universe, s.entityId)}`)
    } else {
      const d = definersOf(universe).find((x) => x.id === s.definerId)
      if (d) update((u) => choose(u, s.entityId, d, s.optionId))
      toast(`${entityName(universe, s.entityId)}: ${s.definerName} · ${entityName(universe, s.optionId)}`, { action: { label: 'Ver ficha', run: () => peek(s.entityId) } })
    }
  }
  return (
    <section className="margin-section margin-suggestions" aria-label="Sugestões do texto">
      <h3 className="section-label">
        <Lightbulb size={13} aria-hidden="true" /> Sugestões
      </h3>
      <ul className="suggestions">
        {list.map((s) => (
          <li key={s.key}>
            <p className="small">
              {s.kind === 'apelido' ? (
                <>
                  “{s.alias}” aparece sozinho {s.count === 1 ? '1 vez' : `${s.count} vezes`}. Ligar a <strong>{entityName(universe, s.entityId)}</strong> como apelido?
                </>
              ) : (
                <>
                  “{s.quote.trim()}”: {s.definerName} de <strong>{entityName(universe, s.entityId)}</strong> é {entityName(universe, s.optionId)}?
                </>
              )}
            </p>
            <div className="row">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => accept(s)}>
                <Check size={14} aria-hidden="true" /> Aceitar
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => skip(s)}>
                <X size={14} aria-hidden="true" /> Agora não
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
