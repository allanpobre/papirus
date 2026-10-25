import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Marca o bloco (parágrafo, citação…) onde está o cursor com a classe `is-current`. Quem usa é o CSS. */
export const CurrentBlock = Extension.create({
  name: 'currentBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('currentBlock'),
        props: {
          decorations(state) {
            const { $from } = state.selection
            if ($from.depth < 1) return null
            const start = $from.before(1)
            const node = state.doc.nodeAt(start)
            if (!node) return null
            return DecorationSet.create(state.doc, [Decoration.node(start, start + node.nodeSize, { class: 'is-current' })])
          },
        },
      }),
    ]
  },
})
