import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, BookmarkPlus, Italic, Link2, Quote, SeparatorHorizontal, Sparkles, Strikethrough, UserPlus } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MentionMatcher } from '../logic/detection'
import type { SceneDoc } from '../model/schema'
import { sceneExtensions } from './extensions'

export interface SelectionInfo {
  text: string
  from: number
  to: number
  /** Parágrafo inteiro onde a seleção está, para saber se é fala. */
  paragraph: string
}

export interface SceneEditorActions {
  /** Ligar a seleção a uma ficha. */
  link: (sel: SelectionInfo) => void
  /** Capturar um fato a partir da seleção. */
  capture: (sel: SelectionInfo) => void
  /** Criar ficha com o texto selecionado. */
  createEntity: (sel: SelectionInfo) => void
  /** Guardar o trecho na Inbox. */
  keep: (sel: SelectionInfo) => void
  /** Ctrl/⌘ + clique num nome. */
  openEntity: (entityId: string) => void
}

interface Props {
  doc: SceneDoc
  onChange: (doc: SceneDoc, text: string) => void
  /** Texto do parágrafo onde está o cursor (após uma pausa). */
  onCursorParagraph?: (text: string) => void
  matcher: MentionMatcher | null
  actions: SceneEditorActions
  showToolbar: boolean
  onReady?: (editor: Editor) => void
}

/**
 * Editor de uma cena. Deve ser montado com `key={scene.id}`: o conteúdo inicial
 * só é lido na montagem, e o editor passa a ser a fonte da verdade do texto.
 */
export function SceneEditor({ doc, onChange, onCursorParagraph, matcher, actions, showToolbar, onReady }: Props) {
  const cb = useRef({ onChange, onCursorParagraph, actions })
  useLayoutEffect(() => {
    cb.current = { onChange, onCursorParagraph, actions }
  })
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const editor = useEditor({
    extensions: sceneExtensions,
    content: doc,
    autofocus: 'end',
    editorProps: {
      attributes: { 'aria-label': 'Texto da cena', class: 'scene-text', spellcheck: 'true', lang: 'pt-BR' },
      handleClick: (_view, _pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false
        const el = (event.target as HTMLElement).closest('[data-entity]')
        const id = el?.getAttribute('data-entity')
        if (!id) return false
        cb.current.actions.openEntity(id)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      cb.current.onChange(editor.getJSON() as SceneDoc, editor.getText({ blockSeparator: '\n\n' }))
    },
    onSelectionUpdate: ({ editor }) => {
      clearTimeout(cursorTimer.current)
      cursorTimer.current = setTimeout(() => {
        cb.current.onCursorParagraph?.(editor.state.selection.$from.parent.textContent)
      }, 400)
    },
  })

  useEffect(() => () => clearTimeout(cursorTimer.current), [])

  useEffect(() => {
    if (!editor.isDestroyed) editor.commands.setMatcher(matcher)
  }, [editor, matcher])

  useEffect(() => {
    onReady?.(editor)
  }, [editor, onReady])

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      quote: editor.isActive('blockquote'),
      mention: editor.isActive('mention'),
    }),
  })

  const selection = (): SelectionInfo => {
    const { from, to, $from } = editor.state.selection
    return { text: editor.state.doc.textBetween(from, to, ' ').trim(), from, to, paragraph: $from.parent.textContent }
  }

  return (
    <div className="scene-editor">
      {showToolbar && (
        <div className="format-bar" role="toolbar" aria-label="Formatação">
          <button type="button" className="btn-icon" aria-pressed={active.bold} title="Negrito (Ctrl+B)" aria-label="Negrito" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={16} />
          </button>
          <button type="button" className="btn-icon" aria-pressed={active.italic} title="Itálico (Ctrl+I)" aria-label="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={16} />
          </button>
          <button type="button" className="btn-icon" aria-pressed={active.strike} title="Tachado (Ctrl+Shift+S)" aria-label="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={16} />
          </button>
          <button type="button" className="btn-icon" aria-pressed={active.quote} title="Citação (> no início da linha)" aria-label="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={16} />
          </button>
          <button
            type="button"
            className="btn-icon"
            title="Separador de cena (ou digite --- numa linha vazia)"
            aria-label="Separador de cena"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <SeparatorHorizontal size={16} />
          </button>
        </div>
      )}

      <BubbleMenu
        editor={editor}
        className="bubble-wrap"
        appendTo={() => document.body}
        options={{ placement: 'top', strategy: 'fixed', offset: 8, flip: true, shift: { padding: 8 } }}
        shouldShow={({ editor, state }) => !state.selection.empty && editor.isFocused}
      >
        {/* Clicar no menu não pode tirar o foco do editor, senão o menu some antes do clique. */}
        <div className="bubble" role="toolbar" aria-label="Ações da seleção" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" className="btn-icon" aria-pressed={active.bold} aria-label="Negrito" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </button>
          <button type="button" className="btn-icon" aria-pressed={active.italic} aria-label="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </button>
          <span className="bubble-sep" />
          {active.mention ? (
            <button type="button" className="bubble-btn" onClick={() => editor.chain().focus().unsetMention().run()}>
              <Link2 size={15} /> Desvincular
            </button>
          ) : (
            <button type="button" className="bubble-btn" onClick={() => actions.link(selection())}>
              <Link2 size={15} /> Vincular
            </button>
          )}
          <button type="button" className="bubble-btn" onClick={() => actions.capture(selection())}>
            <Sparkles size={15} /> Fato
          </button>
          <button type="button" className="bubble-btn" onClick={() => actions.createEntity(selection())}>
            <UserPlus size={15} /> Ficha
          </button>
          <button type="button" className="bubble-btn" title="Guardar trecho na Inbox" onClick={() => actions.keep(selection())}>
            <BookmarkPlus size={15} /> Guardar
          </button>
        </div>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  )
}
