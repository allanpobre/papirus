import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { setImageServer } from '../images/resolve'
import type { Universe } from '../model/schema'
import { wikiImages } from '../views/wikiImages'
import type { ServerConfig } from './server'
import { shortName } from './sharing'

/**
 * A wiki do mundo aberta pelo link (`?ler=…&modo=wiki`), sem conta: a mesma wiki que o dono vê na
 * página Wiki, com o visual escolhido por ele e sem nada secreto (a wiki tira os segredos sozinha,
 * e o link só recebe a cópia de leitura). Dá para baixar o arquivo e abrir sem internet.
 */
export function WikiLinkPage({ universe, ownerEmail, server }: { universe: Universe; ownerEmail: string; server: ServerConfig }) {
  const [html, setHtml] = useState('')
  const [failed, setFailed] = useState(false)
  const name = universe.name || 'Sem nome'

  useEffect(() => {
    document.title = `${name} — wiki`
    // As imagens (capa, retratos, mapas) vêm do servidor do link.
    setImageServer(server)
    let alive = true
    void (async () => {
      try {
        const [{ buildWiki }, images] = await Promise.all([import('../export/wiki'), wikiImages(universe)])
        if (alive) setHtml(buildWiki(universe, { upTo: null, images }).html)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [universe, server, name])

  return (
    <main className="wiki-link-page">
      <header className="wiki-link-bar">
        <p className="wiki-link-made small">
          Wiki de <strong>{name}</strong>
          <span className="muted">
            {' '}
            · compartilhada {ownerEmail ? `por ${shortName(ownerEmail)} ` : ''}com o <a href="../">Papirus</a>
          </span>
        </p>
        <button type="button" className="btn btn-sm" disabled={!html} onClick={() => downloadText(fileNameFor(`${name} wiki`, 'html'), html, 'text/html')}>
          <Download size={14} aria-hidden="true" /> Baixar
        </button>
      </header>
      {failed ? (
        <p className="wiki-link-loading" role="alert">
          Não foi possível montar a wiki. Recarregue a página.
        </p>
      ) : html ? (
        <iframe className="wiki-link-frame" title={`Wiki de ${name}`} sandbox="allow-scripts" srcDoc={html} />
      ) : (
        <p className="wiki-link-loading">Montando a wiki…</p>
      )}
    </main>
  )
}
