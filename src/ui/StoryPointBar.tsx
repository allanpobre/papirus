import { Eye, Milestone } from 'lucide-react'
import { useMemo } from 'react'
import { manuscriptOrder, sceneTitle } from '../model/universe'
import { useStoryPoint } from '../state/storyPoint'
import { useWorkspace } from '../state/workspace'

/**
 * A régua da história: até qual cena se olha, e se é para ver como o leitor. O autor vê tudo por padrão,
 * com marcas do que o leitor só descobre depois; "como o leitor" esconde o que ele ainda não sabe.
 * É a mesma escolha em todas as telas.
 */
export function StoryPointBar() {
  const { universe } = useWorkspace()
  const [point, setPoint] = useStoryPoint(universe.id)
  const order = manuscriptOrder(universe)
  const groups = useMemo(() => {
    const out: { title: string; scenes: { id: string; label: string }[] }[] = []
    order.forEach((s, i) => {
      const story = universe.stories.find((st) => st.id === s.storyId)
      const title = story ? story.title || 'Sem título' : 'Sem capítulo'
      let g = out.at(-1)
      if (!g || g.title !== title) out.push((g = { title, scenes: [] }))
      g.scenes.push({ id: s.id, label: `${i + 1}. ${sceneTitle(s)}` })
    })
    return out
  }, [order, universe.stories])
  if (!order.length) return null
  const current = order.find((s) => s.id === point.sceneId)

  return (
    <div className={`story-point${point.reader ? ' is-reader' : ''}${current ? ' is-set' : ''}`} role="group" aria-label="Ponto da história">
      <label className="story-point-pick">
        <Milestone size={15} aria-hidden="true" />
        <span className="sr-only">Até onde na história</span>
        <select className="input input-sm" aria-label="Até onde na história" value={current?.id ?? ''} onChange={(ev) => setPoint({ ...point, sceneId: ev.target.value || null })}>
          <option value="">A história toda</option>
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Até {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="toggle small story-point-reader">
        <input type="checkbox" role="switch" checked={point.reader} onChange={(ev) => setPoint({ ...point, reader: ev.target.checked })} />
        <span className="toggle-track" aria-hidden="true" />
        <span>
          <Eye size={14} aria-hidden="true" /> Ver como o leitor
        </span>
      </label>
      {(point.reader || current) && (
        <p className="story-point-note tiny muted" role="status">
          {point.reader
            ? `Como o leitor ${current ? `ao terminar “${sceneTitle(current)}”` : 'no fim da história'}: o que ele ainda não sabe fica escondido.`
            : `Até “${current ? sceneTitle(current) : ''}”. Você vê tudo; o que o leitor só descobre depois vem marcado.`}
        </p>
      )}
    </div>
  )
}
