import { Trash2 } from 'lucide-react'
import { ImageButtons, Picture } from '../images/Picture'
import { changeBlock, layoutOf, type Block } from '../model/blocks'
import type { Entity } from '../model/schema'
import { manuscriptOrder, patch, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/*
 * Os blocos de conteúdo da página da ficha: nota (um texto com título), citação (um trecho de uma cena, com o
 * link para ela) e galeria (imagens). Guardam o que têm no próprio bloco.
 */

/** O que o bloco mostra (os segredos e revelações no texto valem como no resto da ficha). Vazio: o lembrete de editar. */
export function ContentBlockView({ block, author, rich }: { block: Block; author: boolean; rich: (text: string) => React.ReactNode[] }) {
  const { universe, go } = useWorkspace()
  if (block.type === 'nota') {
    if (!block.text?.trim() && !block.title?.trim()) return author ? <p className="muted small block-empty">Nota vazia. Toque no lápis para escrever.</p> : null
    return (
      <section aria-label={block.title || 'Nota'}>
        {block.title && <h2>{block.title}</h2>}
        {block.text
          ?.split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((p, i) => {
            const shown = rich(p.trim())
            return shown.length ? <p key={i}>{shown}</p> : null
          })}
      </section>
    )
  }
  if (block.type === 'citacao') {
    const scene = block.sceneId ? universe.scenes.find((s) => s.id === block.sceneId) : undefined
    if (!block.text?.trim()) return author ? <p className="muted small block-empty">Citação vazia. Toque no lápis para escolher a cena e o trecho.</p> : null
    return (
      <figure className="block-quote">
        <blockquote>{rich(block.text)}</blockquote>
        {scene && (
          <figcaption className="small">
            <button type="button" className="link-btn" onClick={() => go('escrever', scene.id)}>
              {sceneTitle(scene)}
            </button>
          </figcaption>
        )}
      </figure>
    )
  }
  if (block.type === 'galeria') {
    const images = block.images ?? []
    if (!images.length) return author ? <p className="muted small block-empty">Galeria vazia. Toque no lápis para pôr imagens.</p> : null
    return (
      <section aria-label={block.title || 'Galeria'}>
        {block.title && <h2>{block.title}</h2>}
        <div className="block-gallery">
          {images.map((img, i) => (
            <Picture key={`${img}-${i}`} value={img} alt={`Imagem ${i + 1}${block.title ? ` de ${block.title}` : ''}`} className="block-gallery-img" />
          ))}
        </div>
      </section>
    )
  }
  return null
}

/** Editar o bloco de conteúdo ali mesmo. Cada mudança lê a ficha atual (duas mudanças seguidas não se perdem). */
export function ContentBlockEditor({ entity, block }: { entity: Entity; block: Block }) {
  const { universe, update, toast } = useWorkspace()
  const set = (changes: (b: Block) => Partial<Block>) =>
    update((u) => {
      const e = u.entities.find((x) => x.id === entity.id)
      const b = e && layoutOf(e).find((x) => x.id === block.id)
      return e && b ? patch(u, 'entities', e.id, { blocks: changeBlock(e, b.id, changes(b)) }) : u
    })
  const order = manuscriptOrder(universe)

  if (block.type === 'citacao')
    return (
      <div className="block-form">
        <label className="field">
          <span className="field-label">Cena</span>
          <select className="input select" value={block.sceneId ?? ''} onChange={(ev) => set(() => ({ sceneId: ev.target.value || null }))}>
            <option value="">Sem cena</option>
            {order.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {sceneTitle(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">O trecho</span>
          <textarea className="input textarea" rows={3} placeholder="Cole aqui a frase da cena" value={block.text ?? ''} onChange={(ev) => set(() => ({ text: ev.target.value }))} />
        </label>
      </div>
    )
  if (block.type === 'galeria')
    return (
      <div className="block-form">
        <input className="input" aria-label="Título da galeria" placeholder="Título (opcional)" value={block.title ?? ''} onChange={(ev) => set(() => ({ title: ev.target.value }))} />
        <div className="block-gallery">
          {(block.images ?? []).map((img, i) => (
            <span key={`${img}-${i}`} className="block-gallery-item">
              <Picture value={img} alt={`Imagem ${i + 1}`} className="block-gallery-img" />
              <button type="button" className="btn-icon btn-sm" aria-label={`Tirar a imagem ${i + 1}`} onClick={() => set((b) => ({ images: (b.images ?? []).filter((_, j) => j !== i) }))}>
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="row">
          <ImageButtons value={null} use="cena" chooseLabel="Pôr imagem" onChange={(ref) => ref && set((b) => ({ images: [...(b.images ?? []), ref] }))} onError={(m) => toast(m, { tone: 'erro' })} />
        </div>
      </div>
    )
  return (
    <div className="block-form">
      <input className="input" aria-label="Título da nota" placeholder="Título (opcional)" value={block.title ?? ''} onChange={(ev) => set(() => ({ title: ev.target.value }))} />
      <textarea className="input textarea" rows={4} aria-label="Texto da nota" placeholder="Escreva livremente." value={block.text ?? ''} onChange={(ev) => set(() => ({ text: ev.target.value }))} />
    </div>
  )
}
