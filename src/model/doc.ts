import type { SceneDoc } from './schema'

/** Documento do editor a partir de parágrafos; `---` vira separador de cena e _assim_ vira itálico. */
export function docFromParagraphs(paragraphs: string[]): SceneDoc {
  return {
    type: 'doc',
    content: paragraphs.map((p) =>
      p === '---'
        ? { type: 'horizontalRule' }
        : {
            type: 'paragraph',
            content: p
              ? p
                  .split(/(_[^_]+_)/)
                  .filter(Boolean)
                  .map((part) => (/^_[^_]+_$/.test(part) ? { type: 'text', text: part.slice(1, -1), marks: [{ type: 'italic' }] } : { type: 'text', text: part }))
              : undefined,
          },
    ),
  }
}
