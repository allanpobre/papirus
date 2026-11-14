import { Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isLocalOnly } from '../model/sample'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'
import { WikiCard } from './WikiCard'
import { wikiImages } from './wikiImages'

/**
 * A Wiki como página de verdade: de um lado, como ela sai (formato, recorte e Personalizar,
 * sempre aberto); do outro, a prévia viva, com a capa e os retratos, que muda a cada escolha.
 * No celular, a prévia vem primeiro.
 */
export default function WikiView() {
  const { universe, source, readOnly, openShare } = useWorkspace()
  // O link é do dono (o exemplo fica só neste aparelho e não se compartilha).
  const canLink = source.kind === 'proprio' && !readOnly && !isLocalOnly(universe)
  const [html, setHtml] = useState('')
  // Se o dono limitou o link a uma cena (no Compartilhar), a prévia mostra o mesmo: é o que o link mostra.
  const upScene = universe.settings.wiki?.upToScene ? manuscriptOrder(universe).find((s) => s.id === universe.settings.wiki?.upToScene) : undefined
  const images = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      void (async () => {
        const [{ buildWiki, linkUpTo }, imgs] = await Promise.all([import('../export/wiki'), images.current ? Promise.resolve(images.current) : wikiImages(universe)])
        images.current = imgs
        if (alive) setHtml(buildWiki(universe, { upTo: linkUpTo(universe), images: imgs }).html)
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
          {upScene && (
            <p className="wiki-view-limit small" role="status">
              A prévia vai só até “{upScene.title || 'Sem título'}”: é o que o link mostra. Para mudar, abra o Compartilhar.
            </p>
          )}
          {html ? <iframe className="wiki-view-preview" title="Prévia da wiki" sandbox="allow-scripts" srcDoc={html} /> : <div className="wiki-view-preview wiki-view-loading">Montando a prévia…</div>}
        </div>
        <div className="wiki-view-options">
          {canLink && (
            <section className="settings-card wiki-link-box" data-tour="wiki-link" aria-labelledby="wiki-link-title">
              <h2 id="wiki-link-title" className="section-title">
                Link para mandar
              </h2>
              <p className="small muted">
                Um endereço que abre esta wiki em qualquer celular, sem conta e sem nada secreto. Quando o mundo muda, a wiki do link muda junto.
              </p>
              <button type="button" className="btn btn-sm" onClick={() => openShare('wiki')}>
                <Link2 size={14} aria-hidden="true" /> Pegar o link da wiki
              </button>
            </section>
          )}
          <WikiCard editor />
        </div>
      </div>
    </div>
  )
}
