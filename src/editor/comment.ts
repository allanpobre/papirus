import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /** Prende um comentário à seleção atual. */
      setComment: (commentId: string) => ReturnType
      /** Tira a marca de um comentário de todo o texto (ao resolver ou apagar). */
      removeComment: (commentId: string) => ReturnType
    }
  }
}

/**
 * Comentário do autor preso a um trecho. O texto do comentário fica na cena
 * (`scene.comments`); no documento fica só a marca com o id. Não sai na exportação.
 */
export const Comment = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment'),
        renderHTML: (attrs) => ({ 'data-comment': attrs.commentId }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'comment-mark' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      removeComment:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const type = state.schema.marks.comment
          state.doc.descendants((node, pos) => {
            if (!node.isText) return
            for (const m of node.marks) {
              if (m.type === type && m.attrs.commentId === commentId) tr.removeMark(pos, pos + node.nodeSize, m)
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})
