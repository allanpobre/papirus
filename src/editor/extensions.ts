import StarterKit from '@tiptap/starter-kit'

/**
 * Formatação da prosa: negrito, itálico, tachado, citação, listas e separador de cena.
 * Títulos, código e links ficam fora do texto da cena por enquanto; o título da cena
 * é um campo próprio.
 */
export const sceneExtensions = [
  StarterKit.configure({
    heading: false,
    code: false,
    codeBlock: false,
    link: false,
    underline: false,
  }),
]
