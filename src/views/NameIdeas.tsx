import { Dices, RefreshCw } from 'lucide-react'
import { useState } from 'react'
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
export function NameIdeas({ kind, onPick }: { kind: string; onPick: (name: string) => void }) {
  const { universe } = useWorkspace()
  const [names, setNames] = useState<string[] | null>(null)
  const roll = () => {
    const sameKind = universe.entities.filter((e) => e.kind === kind).map((e) => e.name)
    const samples = sameKind.length >= 6 || kind === 'lugar' || kind === 'reino' ? sameKind : [...sameKind, ...universe.entities.filter((e) => e.kind === 'personagem').map((e) => e.name)]
    setNames(generateNames(samples, styleFor(kind, guessGuide(universe.settings.fieldTemplates)), 6))
  }
  return (
    <div className="name-ideas">
      {names === null ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={roll}>
          <Dices size={15} /> Sugerir nomes
        </button>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Nomes sugeridos">
            {names.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => onPick(n)}>
                {n}
              </button>
            ))}
          </div>
          <button type="button" className="btn-icon btn-sm" aria-label="Outros nomes" title="Outros nomes" onClick={roll}>
            <RefreshCw size={14} />
          </button>
        </>
      )}
    </div>
  )
}
