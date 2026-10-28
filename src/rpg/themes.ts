/**
 * Temas da mesa: cada mesa tem o seu, escolhido pelo mestre conforme o gênero do jogo.
 * Quem joga só escolhe claro ou escuro. As cores ficam em styles/mesa.css.
 */
export interface MesaTheme {
  id: string
  name: string
  genre: string
  /** Amostra para o seletor: fundo, cartão e destaque. */
  dark: [string, string, string]
  light: [string, string, string]
}

export const MESA_THEMES: MesaTheme[] = [
  { id: 'tempestade', name: 'Tempestade', genre: 'Fantasia épica', dark: ['#0d0f15', '#1b1f2a', '#f0536f'], light: ['#eceef4', '#f0f2f7', '#b81d3c'] },
  { id: 'pergaminho', name: 'Pergaminho', genre: 'Fantasia clássica', dark: ['#101512', '#1c241f', '#dcb85c'], light: ['#efe6d0', '#f2e9d4', '#2f6b4f'] },
  { id: 'paranormal', name: 'Paranormal', genre: 'Terror e investigação', dark: ['#09090c', '#17171e', '#a97bff'], light: ['#ecebf0', '#efeef4', '#6b33d6'] },
  { id: 'abismo', name: 'Abismo', genre: 'Horror cósmico', dark: ['#061113', '#112125', '#3fd1b0'], light: ['#e6f0ee', '#ebf3f1', '#0c6f5d'] },
  { id: 'neon', name: 'Neon', genre: 'Ficção científica', dark: ['#080b17', '#141a2d', '#38d3ff'], light: ['#e9eef8', '#edf1f9', '#0763a3'] },
  { id: 'floresta', name: 'Floresta', genre: 'Fantasia feérica', dark: ['#0b120d', '#162119', '#94d86f'], light: ['#e9efe2', '#edf2e6', '#356f22'] },
]

/** "Sem tema": a mesa usa as cores normais do app. */
export const NO_THEME = 'nenhum'

/** Tema sugerido pelo sistema de jogo, para quem ainda não escolheu. */
export function suggestedTheme(systemName: string | undefined): string {
  const n = (systemName ?? '').toLowerCase()
  if (/paranormal|terror|horror/.test(n)) return 'paranormal'
  if (/cthulhu|d100/.test(n)) return 'abismo'
  if (/cyber|sci|futur|estrela|espa/.test(n)) return 'neon'
  if (/d&d|5e|pathfinder/.test(n)) return 'pergaminho'
  return 'tempestade'
}

/** O tema da mesa: o escolhido pelo mestre ou o sugerido pelo sistema. `null` = sem tema. */
export function mesaTheme(chosen: string | null | undefined, systemName: string | undefined): string | null {
  const id = chosen ?? suggestedTheme(systemName)
  if (id === NO_THEME) return null
  return MESA_THEMES.some((t) => t.id === id) ? id : 'tempestade'
}
