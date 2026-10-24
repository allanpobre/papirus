import f0 from '@fontsource-variable/literata/files/literata-latin-opsz-normal.woff2?url'
import f1 from '@fontsource-variable/literata/files/literata-latin-opsz-italic.woff2?url'
import f2 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url'
import f3 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url'
import f4 from '@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2?url'
import f5 from '@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff2?url'
import f6 from '@fontsource/crimson-pro/files/crimson-pro-latin-400-italic.woff2?url'
import f7 from '@fontsource/crimson-pro/files/crimson-pro-latin-600-normal.woff2?url'
import f8 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import f9 from '@fontsource/lora/files/lora-latin-400-italic.woff2?url'
import f10 from '@fontsource/lora/files/lora-latin-600-normal.woff2?url'
import f11 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url'
import f12 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2?url'
import f13 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url'
import f14 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'
import f15 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-italic.woff2?url'
import f16 from '@fontsource/young-serif/files/young-serif-latin-400-normal.woff2?url'
import f17 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url'
import f18 from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff2?url'
import f19 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import f20 from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url'
import f21 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url'
import f22 from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2?url'

/**
 * Fontes do livro diagramado. Vão embutidas no arquivo para imprimir, para o livro sair
 * igual em qualquer computador. Só o alfabeto latino (cobre o português inteiro).
 */
export interface BookFont {
  label: string
  /** Nome próprio dentro do livro (não colide com as fontes do app). */
  family: string
  stack: string
  faces: { url: string; weight: string; style: string }[]
}

export const BOOK_FONTS = {
  literata: { label: 'Literata', family: "Literata Book", stack: "'Literata Book', Georgia, serif", faces: [{ url: f0, weight: '200 900', style: 'normal' }, { url: f1, weight: '200 900', style: 'italic' }] },
  garamond: { label: 'EB Garamond', family: "EB Garamond Book", stack: "'EB Garamond Book', Garamond, Georgia, serif", faces: [{ url: f2, weight: '400', style: 'normal' }, { url: f3, weight: '400', style: 'italic' }, { url: f4, weight: '600', style: 'normal' }] },
  crimson: { label: 'Crimson Pro', family: "Crimson Pro Book", stack: "'Crimson Pro Book', Georgia, serif", faces: [{ url: f5, weight: '400', style: 'normal' }, { url: f6, weight: '400', style: 'italic' }, { url: f7, weight: '600', style: 'normal' }] },
  lora: { label: 'Lora', family: "Lora Book", stack: "'Lora Book', Georgia, serif", faces: [{ url: f8, weight: '400', style: 'normal' }, { url: f9, weight: '400', style: 'italic' }, { url: f10, weight: '600', style: 'normal' }] },
  baskerville: { label: 'Libre Baskerville', family: "Libre Baskerville Book", stack: "'Libre Baskerville Book', Baskerville, Georgia, serif", faces: [{ url: f11, weight: '400', style: 'normal' }, { url: f12, weight: '400', style: 'italic' }, { url: f13, weight: '700', style: 'normal' }] },
  mono: { label: 'IBM Plex Mono', family: "IBM Plex Mono Book", stack: "'IBM Plex Mono Book', 'Courier New', monospace", faces: [{ url: f14, weight: '400', style: 'normal' }, { url: f15, weight: '400', style: 'italic' }] },
  young: { label: 'Young Serif', family: "Young Serif Book", stack: "'Young Serif Book', Georgia, serif", faces: [{ url: f16, weight: '400', style: 'normal' }] },
  cinzel: { label: 'Cinzel', family: "Cinzel Book", stack: "'Cinzel Book', 'Trajan Pro', serif", faces: [{ url: f17, weight: '400', style: 'normal' }, { url: f18, weight: '700', style: 'normal' }] },
  playfair: { label: 'Playfair Display', family: "Playfair Display Book", stack: "'Playfair Display Book', Georgia, serif", faces: [{ url: f19, weight: '400', style: 'normal' }, { url: f20, weight: '400', style: 'italic' }, { url: f21, weight: '700', style: 'normal' }] },
  sans: { label: 'Instrument Sans', family: "Instrument Sans Book", stack: "'Instrument Sans Book', 'Helvetica Neue', Arial, sans-serif", faces: [{ url: f22, weight: '400 700', style: 'normal' }] },
} satisfies Record<string, BookFont>

export type BookFontKey = keyof typeof BOOK_FONTS

/** As regras @font-face das fontes usadas. */
export function fontFaces(keys: BookFontKey[]): string {
  return [...new Set(keys)]
    .flatMap((k) => BOOK_FONTS[k].faces.map((f) => `@font-face{font-family:"${BOOK_FONTS[k].family}";src:url(${f.url}) format("woff2");font-weight:${f.weight};font-style:${f.style};font-display:block}`))
    .join('\n')
}
