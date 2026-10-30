import type { BookDesign } from '../model/schema'
import { PAGE_SIZES, textWidthMm } from './bookDesign'

/*
 * Para imprimir numa gráfica ou na Amazon (KDP): a capa inteira é sangria + contracapa +
 * lombada + capa + sangria, e a lombada depende do número de páginas e do papel. As espessuras
 * são as que a KDP usa (por página, em polegadas); cada gráfica tem as suas, então é uma
 * estimativa para conferir.
 */

export const PAPERS = {
  branco: { label: 'Branco', inch: 0.002252 },
  creme: { label: 'Creme', inch: 0.0025 },
} as const
export type Paper = keyof typeof PAPERS

/** Sangria de 1/8 de polegada em cada borda (o que passa do corte). */
export const BLEED_MM = 3.175

export function spineMm(pages: number, paper: Paper): number {
  return pages * PAPERS[paper].inch * 25.4
}

/** O tamanho da capa inteira, em mm, com a sangria. */
export function wrapSize(d: BookDesign, pages: number, paper: Paper): { spine: number; width: number; height: number } {
  const { w, h } = PAGE_SIZES[d.pageSize]
  const spine = spineMm(pages, paper)
  return { spine, width: BLEED_MM * 2 + w * 2 + spine, height: h + BLEED_MM * 2 }
}

/** "4,3 mm", "29,1 cm". */
export const mm = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`
export const cm = (n: number) => `${(n / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`

/**
 * O molde da capa inteira em SVG, em milímetros: a sangria, as linhas de corte e de dobra
 * (as bordas da lombada) e uma margem de segurança de 6 mm, com os nomes de cada parte.
 */
export function coverTemplateSvg(d: BookDesign, pages: number, paper: Paper, title: string): string {
  const { w, h } = PAGE_SIZES[d.pageSize]
  const { spine, width, height } = wrapSize(d, pages, paper)
  const b = BLEED_MM
  const safe = 6
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const r = (n: number) => +n.toFixed(2)
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, dash = '') => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${color}" stroke-width="0.3"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
  const back = b
  const spineX = b + w
  const front = b + w + spine
  const text = (x: number, y: number, s: string, size = 4) => `<text x="${r(x)}" y="${r(y)}" font-family="sans-serif" font-size="${size}" text-anchor="middle" fill="#555">${esc(s)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(width)}mm" height="${r(height)}mm" viewBox="0 0 ${r(width)} ${r(height)}">
<rect width="${r(width)}" height="${r(height)}" fill="#fff"/>
<rect x="0" y="0" width="${r(width)}" height="${r(height)}" fill="none" stroke="#e33" stroke-width="0.3"/>
<rect x="${r(b)}" y="${r(b)}" width="${r(width - 2 * b)}" height="${r(h)}" fill="none" stroke="#000" stroke-width="0.3"/>
${line(spineX, 0, spineX, height, '#36c', '2 1.5')}${line(front, 0, front, height, '#36c', '2 1.5')}
<rect x="${r(back + safe)}" y="${r(b + safe)}" width="${r(w - 2 * safe)}" height="${r(h - 2 * safe)}" fill="none" stroke="#2a2" stroke-width="0.2" stroke-dasharray="1 1"/>
<rect x="${r(front + safe)}" y="${r(b + safe)}" width="${r(w - 2 * safe)}" height="${r(h - 2 * safe)}" fill="none" stroke="#2a2" stroke-width="0.2" stroke-dasharray="1 1"/>
${text(back + w / 2, b + h / 2, 'Contracapa')}${text(front + w / 2, b + h / 2, 'Capa')}${text(front + w / 2, b + h / 2 + 7, title, 3)}
${spine >= 6 ? `<text x="${r(spineX + spine / 2)}" y="${r(b + h / 2)}" font-family="sans-serif" font-size="3" text-anchor="middle" fill="#555" transform="rotate(90 ${r(spineX + spine / 2)} ${r(b + h / 2)})">Lombada</text>` : ''}
${text(back + w / 2, b + h - safe - 6, `Capa inteira ${cm(width)} × ${cm(height)} · lombada ${mm(spine)} (${pages} páginas, papel ${PAPERS[paper].label.toLowerCase()})`, 2.4)}
${text(back + w / 2, b + h - safe - 2, 'vermelho: sangria · preto: corte · azul: dobra · verde: área segura', 2.4)}
</svg>`
}

/** Quantos caracteres cabem numa linha, aproximadamente (a letra média tem ~0,47 do tamanho; na de máquina, 0,6). */
export function charsPerLine(d: BookDesign): number {
  const em = d.fontSize * 0.3528
  return Math.round(textWidthMm(d) / (em * (d.bodyFont === 'mono' ? 0.6 : 0.47)))
}

/** Bringhurst: de 45 a 75 caracteres é confortável; 66 é o ideal. */
export function lineComfort(chars: number): string {
  if (chars < 45) return 'linha curta: o olho volta muito'
  if (chars > 75) return 'linha longa: pode cansar'
  return 'confortável (de 45 a 75)'
}
