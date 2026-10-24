import { Extension, InputRule } from '@tiptap/core'
import { BulletList } from '@tiptap/extension-list'

/**
 * Travessão de fala, como se escreve em português: "- " ou "-- " no começo do
 * parágrafo vira "— ", e " - " no meio da frase (o inciso da fala) vira " — ".
 * Backspace logo depois desfaz, para quem queria mesmo o hífen.
 */
export const DialogueDash = Extension.create({
  name: 'travessao',
  addInputRules() {
    return [
      new InputRule({
        find: /^(?:-{1,2}|–) $/,
        handler: ({ state, range }) => {
          state.tr.insertText('— ', range.from, range.to)
        },
      }),
      new InputRule({
        find: /(?<=\S) [-–] $/,
        handler: ({ state, range }) => {
          state.tr.insertText(' — ', range.from, range.to)
        },
      }),
    ]
  },
})

/** Listas continuam existindo (barra e colar), mas "- " não vira lista: é fala. */
export const ProseBulletList = BulletList.extend({
  addInputRules() {
    return []
  },
})
