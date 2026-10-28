import { Download, ExternalLink, Globe } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/** Wiki do mundo: um arquivo HTML para jogadores ou leitores, sem segredos (e, se quiser, sem spoiler). */
export function WikiCard() {
  const { universe } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const [upTo, setUpTo] = useState<string>('tudo')

  const build = async () => {
    const { buildWiki } = await import('../export/wiki')
    return buildWiki(universe, { upTo: upTo === 'tudo' ? null : Number(upTo) })
  }

  return (
    <section className="settings-card" aria-labelledby="wiki-titulo">
      <h2 id="wiki-titulo" className="section-title">
        <Globe size={16} aria-hidden="true" /> Wiki do mundo
      </h2>
      <p className="small">
        Um site de uma página só, com as fichas ligadas entre si, busca e linha do tempo. Abre em qualquer navegador, até no celular: mande para os jogadores ou ponha no ar. Segredos e as Ideias nunca vão.
      </p>
      <label className="field">
        <span className="field-label">O que entra</span>
        <select className="input" value={upTo} onChange={(e) => setUpTo(e.target.value)}>
          <option value="tudo">Tudo, menos os segredos</option>
          {scenes.map((s, i) => (
            <option key={s.id} value={i}>
              Só o que o leitor sabe até “{s.title || 'Sem título'}” ({i + 1})
            </option>
          ))}
        </select>
      </label>
      <div className="button-stack">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            void build().then(({ html }) => downloadText(fileNameFor(`${universe.name} wiki`, 'html'), html, 'text/html'))
          }
        >
          <Download size={16} /> Baixar a wiki (.html)
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            void build().then(({ html }) => {
              const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
              window.open(url, '_blank', 'noopener')
              setTimeout(() => URL.revokeObjectURL(url), 60_000)
            })
          }
        >
          <ExternalLink size={16} /> Ver antes
        </button>
      </div>
    </section>
  )
}
