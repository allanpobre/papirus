import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { Comment } from './comment'
import { CurrentBlock } from './currentBlock'
import { DialogueDash, ProseBulletList } from './dialogue'
import { Detection, Mention } from './mention'
import { SceneImage } from './image'

/**
 * Formatação da prosa: negrito, itálico, tachado, citação, listas e separador de cena.
 * Imagens entram como blocos próprios (só a referência fica no texto).
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
    bulletList: false,
  }),
  ProseBulletList,
  DialogueDash,
  Mention,
  Comment,
  SceneImage,
]

export const sceneExtensions = [
  ...baseExtensions,
  Detection,
  CurrentBlock,
  Placeholder.configure({ placeholder: 'Escreva. O resto pode esperar.' }),
]
