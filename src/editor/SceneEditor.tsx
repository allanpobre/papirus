import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, BookmarkPlus, Italic, Link2, MessageSquarePlus, Quote, SeparatorHorizontal, Sparkles, Strikethrough, UserPlus } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MentionMatcher } from '../logic/detection'
import type { SceneDoc } from '../model/schema'
import { sceneExtensions } from './extensions'
import { PhoneDock } from './PhoneDock'
import { useMediaQuery } from '../ui/useMediaQuery'

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
  /** Comentar o trecho (nota do autor). */
  comment: (sel: SelectionInfo) => void
  /** Clique num trecho comentado. */
  openComment: (commentId: string) => void
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
  /** `false` = só leitura (universo compartilhado só para ver). */
  editable?: boolean
}

/**
 * Editor de uma cena. Deve ser montado com `key={scene.id}`: o conteúdo inicial
 * só é lido na montagem, e o editor passa a ser a fonte da verdade do texto.
 */
export function SceneEditor({ doc, onChange, onCursorParagraph, matcher, actions, showToolbar, onReady, editable = true }: Props) {
  const cb = useRef({ onChange, onCursorParagraph, actions })
  useLayoutEffect(() => {
    cb.current = { onChange, onCursorParagraph, actions }
  })
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Celular e tablet de toque: barra presa acima do teclado no lugar do menu flutuante.
  const touch = useMediaQuery('(pointer: coarse), (max-width: 760px)')

  const editor = useEditor({
    extensions: sceneExtensions,
    content: doc,
    editable,
    // Foco manual (abaixo): o automático do editor pode roubar o foco de uma janela recém-aberta.
    autofocus: false,
    editorProps: {
      // Deixa o cursor sempre acima da barra do celular.
      scrollMargin: { top: 16, bottom: 96, left: 0, right: 0 },
      scrollThreshold: { top: 16, bottom: 96, left: 0, right: 0 },
      attributes: { 'aria-label': 'Texto da cena', class: 'scene-text', spellcheck: 'true', lang: 'pt-BR' },
      handleClick: (_view, _pos, event) => {
        const commented = (event.target as HTMLElement).closest('[data-comment]')?.getAttribute('data-comment')
        if (commented && !(event.ctrlKey || event.metaKey)) cb.current.actions.openComment(commented)
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

  // Leva o cursor ao fim do texto ao abrir a cena, se nada mais estiver com o foco.
  // No celular e no tablet não: abriria o teclado e rolaria a página para longe do título.
  useEffect(() => {
    if (matchMedia('(pointer: coarse), (max-width: 760px)').matches) return
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      const free = !active || active === document.body || active.closest('.scene-meta, .write-tree, .rail') !== null
      if (free && !document.querySelector('.overlay, [role="dialog"]') && !editor.isDestroyed) editor.commands.focus('end')
    })
    return () => cancelAnimationFrame(frame)
  }, [editor])

  useEffect(() => {
    if (!editor.isDestroyed) editor.commands.setMatcher(matcher)
  }, [editor, matcher])

  useEffect(() => {
    if (!editor.isDestroyed) editor.setEditable(editable)
  }, [editor, editable])

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
      {showToolbar && !touch && (
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

      {touch && <PhoneDock editor={editor} actions={actions} selection={selection} />}
      {!touch && (
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
          <button type="button" className="bubble-btn" onClick={() => actions.comment(selection())}>
            <MessageSquarePlus size={15} /> Comentar
          </button>
          <button type="button" className="bubble-btn" title="Guardar trecho na Inbox" onClick={() => actions.keep(selection())}>
            <BookmarkPlus size={15} /> Guardar
          </button>
        </div>
      </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
