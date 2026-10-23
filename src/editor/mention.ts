import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { MentionMatcher } from '../logic/detection'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Liga a seleção atual a uma ficha. */
      setMention: (entityId: string) => ReturnType
      unsetMention: () => ReturnType
    }
    detection: {
      setMatcher: (matcher: MentionMatcher | null) => ReturnType
    }
  }
}

/**
 * Menção confirmada pelo autor: um trecho do texto ligado a uma ficha.
 * Fica salva no documento e acompanha o texto quando ele muda.
 */
export const Mention = Mark.create({
  name: 'mention',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-entity'),
        renderHTML: (attrs) => ({ 'data-entity': attrs.entityId }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-entity].mention' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'mention' }, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setMention:
        (entityId) =>
        ({ commands }) =>
          commands.setMark(this.name, { entityId }),
      unsetMention:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

interface DetectionState {
  matcher: MentionMatcher | null
  decorations: DecorationSet
}

const detectionKey = new PluginKey<DetectionState>('detection')

/**
 * Destaca discretamente os nomes de fichas conhecidas. É só visual: nada é
 * salvo no texto e nada vira fato. O autor pode desligar nas configurações.
 */
export const Detection = Extension.create({
  name: 'detection',

  addCommands() {
    return {
      setMatcher:
        (matcher) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(detectionKey, matcher))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DetectionState>({
        key: detectionKey,
        state: {
          init: (): DetectionState => ({ matcher: null, decorations: DecorationSet.empty }),
          apply(tr, value, _old, state) {
            const meta = tr.getMeta(detectionKey) as MentionMatcher | null | undefined
            if (meta !== undefined) return { matcher: meta, decorations: decorate(state, meta) }
            if (!tr.docChanged) return value
            return { matcher: value.matcher, decorations: decorate(state, value.matcher) }
          },
        },
        props: {
          decorations: (state) => detectionKey.getState(state)?.decorations,
        },
      }),
    ]
  },
})

function decorate(state: EditorState, matcher: MentionMatcher | null): DecorationSet {
  if (!matcher || matcher.isEmpty) return DecorationSet.empty
  const decorations: Decoration[] = []
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    const { text, positions } = blockText(node, pos + 1)
    for (const m of matcher.find(text)) {
      decorations.push(
        Decoration.inline(positions[m.from], positions[m.to - 1] + 1, {
          class: 'detected',
          'data-entity': m.entityId,
        }),
      )
    }
    return false
  })
  return DecorationSet.create(state.doc, decorations)
}

/** Texto de um bloco e a posição no documento de cada caractere. */
export function blockText(node: PMNode, start: number) {
  let text = ''
  const positions: number[] = []
  node.forEach((child, offset) => {
    if (child.isText) {
      for (let i = 0; i < child.text!.length; i++) positions.push(start + offset + i)
      text += child.text
    } else {
      positions.push(start + offset)
      text += '\n'
    }
  })
  return { text, positions }
}
