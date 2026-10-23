import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { Comment } from './comment'
import { Detection, Mention } from './mention'

/**
 * Formatação da prosa: negrito, itálico, tachado, citação, listas e separador de cena.
 * Títulos, código e links ficam fora do texto da cena; o título da cena é um campo próprio.
 * Menções a fichas são marcas salvas no texto; a detecção de nomes é só visual.
 */
export const baseExtensions = [
  StarterKit.configure({
    heading: false,
    code: false,
    codeBlock: false,
    link: false,
    underline: false,
  }),
  Mention,
  Comment,
]

export const sceneExtensions = [
  ...baseExtensions,
  Detection,
  Placeholder.configure({ placeholder: 'Escreva. O resto pode esperar.' }),
]
