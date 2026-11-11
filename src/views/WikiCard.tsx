import { Download, ExternalLink, Globe } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { manuscriptOrder } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { imageDataUrl } from '../images/resolve'

const FORMATS = { html: '.html', md: '.md', json: '.json' } as const

/** Wiki do mundo: um arquivo HTML para jogadores ou leitores, sem segredos (e, se quiser, sem spoiler). */
export function WikiCard() {
  const { universe } = useWorkspace()
  const scenes = manuscriptOrder(universe)
  const [upTo, setUpTo] = useState<string>('tudo')
  const [format, setFormat] = useState<'html' | 'md' | 'json'>('html')

  const download = async () => {
    const name = `${universe.name} wiki`
    if (format === 'html') {
      const { html } = await build()
      return downloadText(fileNameFor(name, 'html'), html, 'text/html')
    }
    const { buildWiki, wikiMarkdown } = await import('../export/wiki')
    // Texto e dados vão sem imagens: ficam leves e abrem em qualquer lugar.
    const { data } = buildWiki(universe, { upTo: upTo === 'tudo' ? null : Number(upTo) })
    if (format === 'md') downloadText(fileNameFor(name, 'md'), wikiMarkdown(data))
    else downloadText(fileNameFor(name, 'json'), JSON.stringify(data, null, 2), 'application/json')
  }

  const build = async () => {
    const { buildWiki } = await import('../export/wiki')
    // A capa, os retratos e os mapas vão dentro do arquivo (a wiki abre sem internet e sem conta).
    const images = new Map<string, string>()
    const refs = [universe.settings.cover, ...universe.entities.map((e) => e.image), ...universe.maps.map((m) => m.image)]
    for (const ref of refs) {
      if (!ref || images.has(ref)) continue
      const data = await imageDataUrl(ref).catch(() => null)
      if (data) images.set(ref, data)
    }
    return buildWiki(universe, { upTo: upTo === 'tudo' ? null : Number(upTo), images })
  }

  return (
    <section className="settings-card" aria-labelledby="wiki-titulo">
      <h2 id="wiki-titulo" className="section-title">
        <Globe size={16} aria-hidden="true" /> Wiki do mundo
      </h2>
      <p className="small">
        Um site num arquivo só: abre na capa do mundo, cada ficha na sua página, com busca, linha do tempo, mapas e “Citado em”. Abre em qualquer navegador, até no celular: mande para os jogadores ou ponha no ar. Segredos e as Ideias nunca vão.
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
      <label className="field">
        <span className="field-label">Formato</span>
        <select className="input" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          <option value="html">Site (.html): com capa, retratos e mapas</option>
          <option value="md">Texto (.md): para ler, editar ou levar ao Obsidian</option>
          <option value="json">Dados (.json): para outros programas</option>
        </select>
      </label>
      <div className="button-stack">
        <button type="button" className="btn btn-primary" onClick={() => void download()}>
          <Download size={16} /> Baixar a wiki ({FORMATS[format]})
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
