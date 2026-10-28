import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { addImage } from '../images/add'
import { isImageRef, refToId } from '../images/ref'
import { imageUrl } from '../images/resolve'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneImage: {
      /** Põe uma imagem (referência "img:…") como bloco, no lugar do cursor. */
      insertSceneImage: (src: string, alt?: string) => ReturnType
    }
  }
}

/** Erros ao colar ou arrastar uma imagem (mostrados pelo app). */
let reportError: (message: string) => void = () => undefined
export function onSceneImageError(fn: (message: string) => void) {
  reportError = fn
}
export const sceneImageError = (message: string) => reportError(message)

/** Imagem dentro da cena: um bloco próprio, entre parágrafos. Guarda só a referência. */
export const SceneImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-image]',
        getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute('data-image'), alt: (el as HTMLElement).querySelector('img')?.getAttribute('alt') ?? '' }),
      },
    ]
  },

  renderHTML({ node }) {
    return ['figure', { 'data-image': node.attrs.src, class: 'scene-figure' }, ['img', { alt: node.attrs.alt ?? '' }]]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('figure')
      dom.className = 'scene-figure'
      dom.setAttribute('data-image', String(node.attrs.src ?? ''))
      const img = document.createElement('img')
      img.alt = String(node.attrs.alt ?? '')
      img.draggable = false
      dom.append(img)
      const src = String(node.attrs.src ?? '')
      if (isImageRef(src)) {
        dom.classList.add('is-loading')
        void imageUrl(refToId(src)).then((url) => {
          dom.classList.remove('is-loading')
          if (url) img.src = url
          else dom.classList.add('is-missing')
        })
      } else if (src.startsWith('data:image/')) img.src = src
      return { dom }
    }
  },

  addCommands() {
    return {
      insertSceneImage:
        (src, alt = '') =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { src, alt } }, { type: 'paragraph' }]),
    }
  },

  addProseMirrorPlugins() {
    const insert = (view: EditorView, files: File[], pos?: number) => {
      for (const file of files) {
        void addImage(file, 'cena')
          .then(({ ref }) => {
            if (view.isDestroyed) return
            const type = view.state.schema.nodes[this.name]
            const at = pos ?? view.state.selection.from
            view.dispatch(view.state.tr.insert(Math.min(at, view.state.doc.content.size), type.create({ src: ref, alt: '' })))
          })
          .catch((err: unknown) => reportError(err instanceof Error ? err.message : 'Não foi possível usar esta imagem.'))
      }
    }
    const images = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))
    return [
      new Plugin({
        key: new PluginKey('sceneImagePaste'),
        props: {
          handlePaste: (view, event) => {
            const files = images(event.clipboardData?.files)
            if (!files.length || !view.editable) return false
            insert(view, files)
            return true
          },
          handleDrop: (view, event) => {
            const files = images((event as DragEvent).dataTransfer?.files)
            if (!files.length || !view.editable) return false
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
            insert(view, files, pos)
            return true
          },
        },
      }),
    ]
  },
})
