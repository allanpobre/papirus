import { useEffect, useState } from 'react'
import { useWorkspace } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'
import { WikiCard } from './WikiCard'

/**
 * A Wiki como área própria, num mundo (worldbuilding): o que no livro é Publicar, aqui é a wiki.
 * À esquerda, como sai (formato, recorte, personalizar); à direita, a prévia viva (no PC).
 */
export default function WikiView() {
  const { universe } = useWorkspace()
  const [html, setHtml] = useState('')
  useEffect(() => {
    let alive = true
    // Sem imagens na prévia: fica leve e acompanha cada mudança (o arquivo baixado leva tudo).
    const t = setTimeout(() => {
      void import('../export/wiki').then(({ buildWiki }) => alive && setHtml(buildWiki(universe, { upTo: null }).html))
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [universe])

  return (
    <div className="view wiki-view">
      <ViewTop area="Wiki" tour="wiki" />
      <div className="wiki-view-body">
        <WikiCard />
        {html && <iframe className="wiki-view-preview" title="Prévia da wiki" sandbox="allow-scripts" srcDoc={html} />}
      </div>
    </div>
  )
}
