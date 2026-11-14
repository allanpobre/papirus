import { Dices, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { languageNames, languagesOf } from '../logic/language'
import { generateNames, type NameStyle } from '../logic/names'
import { guessGuide } from '../oficina/guides'
import { useWorkspace } from '../state/workspace'

/** Que lista de partida combina com o tipo de ficha e o gênero do universo. */
function styleFor(kind: string, genre: string): NameStyle {
  const place = kind === 'lugar' || kind === 'reino'
  if (genre === 'fantasia') return place ? 'lugaresFantasia' : 'fantasia'
  if (genre === 'ficcao') return place ? 'lugaresFantasia' : 'ficcao'
  return place ? 'lugares' : 'pessoas'
}

/** "Sugerir nomes": nomes novos no estilo dos que já existem neste universo (do mesmo tipo). */
export function NameIdeas({ kind, onPick, compact = false, culture }: { kind: string; onPick: (name: string) => void; compact?: boolean; culture?: string | null }) {
  const { universe } = useWorkspace()
  const [names, setNames] = useState<string[] | null>(null)
  // No estilo de um povo ou cultura com idioma (as sílabas dele); sem escolher, no estilo dos nomes que já existem.
  const cultures = useMemo(() => languagesOf(universe), [universe])
  const [picked, setPicked] = useState<string | null>(null)
  const styleOf = cultures.find((c) => c.id === (picked ?? culture ?? ''))
  /** Sorteia nomes novos, no estilo de `styleId` (um povo com idioma) ou, sem ele, no do que já existe. */
  const roll = (styleId: string | null = styleOf?.id ?? null) => {
    const lang = cultures.find((c) => c.id === styleId)
    if (lang) {
      setNames(languageNames(lang.language!, 6, Math.random, universe.entities.map((e) => e.name)))
      return
    }
    const sameKind = universe.entities.filter((e) => e.kind === kind).map((e) => e.name)
    const samples = sameKind.length >= 6 || kind === 'lugar' || kind === 'reino' ? sameKind : [...sameKind, ...universe.entities.filter((e) => e.kind === 'personagem').map((e) => e.name)]
    setNames(generateNames(samples, styleFor(kind, guessGuide(universe.settings.fieldTemplates)), 6))
  }
  return (
    <div className={`name-ideas${compact ? ' is-compact' : ''}${names ? ' has-names' : ''}`}>
      {cultures.length > 0 && (
        <select
          className="input input-sm name-ideas-culture"
          aria-label="No estilo de"
          title="No estilo de um povo ou cultura"
          value={styleOf?.id ?? ''}
          onChange={(ev) => {
            setPicked(ev.target.value)
            // Já sorteia no estilo escolhido (sem voltar ao ícone).
            roll(ev.target.value || null)
          }}
        >
          <option value="">Como os nomes que já existem</option>
          {cultures.map((c) => (
            <option key={c.id} value={c.id}>
              No estilo de {c.name}
            </option>
          ))}
        </select>
      )}
      {names === null ? (
        compact ? (
          <button type="button" className="btn btn-ghost" aria-label="Sugerir nomes" title="Sugerir nomes" onClick={() => roll()}>
            <Dices size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => roll()}>
            <Dices size={15} /> Sugerir nomes
          </button>
        )
      ) : (
        <>
          <div className="chips" role="group" aria-label="Nomes sugeridos">
            {names.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => onPick(n)}>
                {n}
              </button>
            ))}
          </div>
          <button type="button" className="btn-icon btn-sm" aria-label="Outros nomes" title="Outros nomes" onClick={() => roll()}>
            <RefreshCw size={14} />
          </button>
        </>
      )}
    </div>
  )
}
