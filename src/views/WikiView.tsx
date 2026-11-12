import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'
import { WikiCard, wikiImages } from './WikiCard'

/**
 * A Wiki como página de verdade: de um lado, como ela sai (formato, recorte e Personalizar,
 * sempre aberto); do outro, a prévia viva, com a capa e os retratos, que muda a cada escolha.
 * No celular, a prévia vem primeiro.
 */
export default function WikiView() {
  const { universe } = useWorkspace()
  const [html, setHtml] = useState('')
  const images = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      void (async () => {
        const [{ buildWiki }, imgs] = await Promise.all([import('../export/wiki'), images.current ? Promise.resolve(images.current) : wikiImages(universe)])
        images.current = imgs
        if (alive) setHtml(buildWiki(universe, { upTo: null, images: imgs }).html)
      })()
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [universe])

  return (
    <div className="view wiki-view">
      <ViewTop area="Wiki" tour="wiki" />
      <div className="wiki-view-body">
        <div className="wiki-view-preview-wrap">
          {html ? <iframe className="wiki-view-preview" title="Prévia da wiki" sandbox="allow-scripts" srcDoc={html} /> : <div className="wiki-view-preview wiki-view-loading">Montando a prévia…</div>}
        </div>
        <div className="wiki-view-options">
          <WikiCard editor />
        </div>
      </div>
    </div>
  )
}
