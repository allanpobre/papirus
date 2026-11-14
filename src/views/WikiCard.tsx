import { Download, ExternalLink, Globe, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { kindPlural } from '../model/labels'
import type { WikiSettings } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { coverLook, TONES } from '../ui/coverLook'
import { useWorkspace } from '../state/workspace'
import { wikiImages } from './wikiImages'

const FORMATS = { html: '.html', md: '.md', json: '.json' } as const

/**
 * Wiki do mundo: um arquivo HTML para jogadores ou leitores, sem segredos (e, se quiser, sem spoiler).
 * Na página Wiki (`editor`) vem com o Personalizar aberto; nas janelas, com o atalho para lá.
 */
export function WikiCard({ editor = false }: { editor?: boolean }) {
  const { universe, go } = useWorkspace()
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
    return buildWiki(universe, { upTo: upTo === 'tudo' ? null : Number(upTo), images: await wikiImages(universe) })
  }

  return (
    <section className="settings-card" aria-labelledby="wiki-titulo">
      <h2 id="wiki-titulo" className="section-title">
        <Globe size={16} aria-hidden="true" /> Wiki do mundo
      </h2>
      <p className="small">
        Um site num arquivo só: abre na capa do mundo, cada ficha na sua página, com busca, linha do tempo, mapas e “Citado em”. Abre em qualquer navegador, até no celular. Segredos e as Ideias nunca vão.
      </p>
      {!editor && (
        <button type="button" className="btn wiki-customize-link" onClick={() => go('wiki')}>
          <SlidersHorizontal size={16} aria-hidden="true" /> Personalizar e ver como fica
        </button>
      )}
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
      {editor && <WikiCustomize />}
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

const FONT_LABELS: Record<NonNullable<WikiSettings['font']>, string> = { serifada: 'Com serifa', 'sem-serifa': 'Sem serifa', livro: 'De livro (justificado)' }
const STYLE_OPTIONS: [NonNullable<WikiSettings['style']>, string, string, string][] = [
  ['classico', 'Clássico', '#fffdf8', '#2a2520'],
  ['moderno', 'Moderno', '#f3f5f7', '#1b1f24'],
  ['pergaminho', 'Pergaminho', '#f3e7c9', '#3a2817'],
  ['noturno', 'Noturno', '#151a1f', '#e4e7ea'],
]
const SECTIONS: [keyof Pick<WikiSettings, 'timeline' | 'maps' | 'cites' | 'portraits'>, string][] = [
  ['timeline', 'Linha do tempo'],
  ['maps', 'Mapas'],
  ['cites', '“Citado em”'],
  ['portraits', 'Retratos'],
]

/** Personalizar a wiki: guardado no universo, vale para o site, o texto e os dados. */
function WikiCustomize() {
  const { universe, update } = useWorkspace()
  const ws: WikiSettings = universe.settings.wiki ?? {}
  const set = (patch: Partial<WikiSettings>) => update((u) => ({ ...u, settings: { ...u.settings, wiki: { ...u.settings.wiki, ...patch } } }))
  const kinds = [...new Set(universe.entities.map((e) => e.kind))].sort((a, b) => kindPlural(a).localeCompare(kindPlural(b), 'pt-BR'))
  const hiddenKinds = new Set(ws.hiddenKinds ?? [])
  const [fieldsText, setFieldsText] = useState((ws.hiddenFields ?? []).join(', '))
  const outside = universe.entities.filter((e) => e.wikiHidden).length
  const cover = coverLook(universe.name).tone
  const color = ws.color ?? null
  // Até que cena vai o link é do Compartilhar: não conta como "do seu jeito" e não volta ao padrão junto.
  const changed = Object.entries(ws).some(([k, v]) => k !== 'upToScene' && v !== undefined)

  return (
    <div className="wiki-custom" role="group" aria-label="Personalizar">
      <h3 className="wiki-custom-title">
        <SlidersHorizontal size={15} aria-hidden="true" /> Personalizar
        {changed && <span className="wiki-custom-mark">do seu jeito</span>}
      </h3>

      <fieldset className="wiki-custom-group">
        <legend>Estilo</legend>
        <div className="wiki-styles" role="radiogroup" aria-label="Estilo da wiki">
          {STYLE_OPTIONS.map(([id, label, paper, ink]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={(ws.style ?? 'classico') === id}
              className="wiki-style"
              onClick={() => set({ style: id === 'classico' ? undefined : id })}
            >
              <span className="wiki-style-swatch" style={{ background: paper, color: ink }} aria-hidden="true">
                <span style={{ background: ws.color ?? cover }} />
                Aa
              </span>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="wiki-custom-group">
        <legend>Abertura</legend>
        <label className="field">
          <span className="field-label">Título</span>
          <input className="input" value={ws.title ?? ''} placeholder={universe.name} onChange={(e) => set({ title: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span className="field-label">Texto de boas-vindas</span>
          <textarea className="input" rows={3} value={ws.intro ?? ''} placeholder={universe.description || 'Para quem chega: do que é este mundo, por onde começar.'} onChange={(e) => set({ intro: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span className="field-label">Autor</span>
          <input className="input" value={ws.author ?? ''} placeholder="Seu nome (opcional)" onChange={(e) => set({ author: e.target.value || undefined })} />
        </label>
      </fieldset>

      <fieldset className="wiki-custom-group">
        <legend>O que entra</legend>
        {kinds.length > 0 && (
          <div className="wiki-custom-checks" role="group" aria-label="Tipos de ficha">
            {kinds.map((k) => (
              <label key={k} className="wiki-check">
                <input
                  type="checkbox"
                  checked={!hiddenKinds.has(k)}
                  onChange={(e) => {
                    const next = new Set(hiddenKinds)
                    if (e.target.checked) next.delete(k)
                    else next.add(k)
                    set({ hiddenKinds: next.size ? [...next] : undefined })
                  }}
                />
                {kindPlural(k)}
              </label>
            ))}
          </div>
        )}
        <label className="field">
          <span className="field-label">Campos escondidos</span>
          <input
            className="input"
            value={fieldsText}
            placeholder="Ex.: Notas do mestre, Fraqueza"
            onChange={(e) => setFieldsText(e.target.value)}
            onBlur={() => {
              const list = fieldsText.split(',').map((t) => t.trim()).filter(Boolean)
              set({ hiddenFields: list.length ? list : undefined })
            }}
          />
        </label>
        <p className="small muted">
          Para tirar uma ficha só, desligue “Entra na wiki” na própria ficha (Editar).{' '}
          {outside > 0 && `Agora: ${outside} ${outside === 1 ? 'ficha fora' : 'fichas fora'}.`}
        </p>
      </fieldset>

      <fieldset className="wiki-custom-group">
        <legend>Seções</legend>
        <div className="wiki-custom-checks">
          {SECTIONS.map(([key, label]) => (
            <label key={key} className="wiki-check">
              <input type="checkbox" checked={ws[key] !== false} onChange={(e) => set({ [key]: e.target.checked ? undefined : false })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="wiki-custom-group">
        <legend>Aparência</legend>
        <div className="wiki-swatches" role="radiogroup" aria-label="Cor da wiki">
          <button type="button" role="radio" aria-checked={color === null} className="wiki-swatch" style={{ background: cover }} title="A cor da capa" onClick={() => set({ color: undefined })}>
            <span className="sr-only">A cor da capa</span>
          </button>
          {TONES.filter((t) => t !== cover).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={color === t} className="wiki-swatch" style={{ background: t }} onClick={() => set({ color: t })}>
              <span className="sr-only">Cor {t}</span>
            </button>
          ))}
          <label className="wiki-swatch wiki-swatch-pick" title="Outra cor">
            <input type="color" value={color ?? cover} onChange={(e) => set({ color: e.target.value })} aria-label="Outra cor" />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Letra</span>
          <select className="input" value={ws.font ?? 'serifada'} onChange={(e) => set({ font: e.target.value === 'serifada' ? undefined : (e.target.value as WikiSettings['font']) })}>
            {Object.entries(FONT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {changed && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setFieldsText('')
            update((u) => ({ ...u, settings: { ...u.settings, wiki: u.settings.wiki?.upToScene ? { upToScene: u.settings.wiki.upToScene } : undefined } }))
          }}
        >
          Voltar ao padrão
        </button>
      )}
    </div>
  )
}
