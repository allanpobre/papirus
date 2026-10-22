import { useLayoutEffect, useRef } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { SceneDoc } from '../model/schema'
import { sceneExtensions } from './extensions'

interface Props {
  doc: SceneDoc
  onChange: (doc: SceneDoc, text: string) => void
}

/**
 * Editor de uma cena. Deve ser montado com `key={scene.id}`: o conteúdo inicial
 * só é lido na montagem, e o editor passa a ser a fonte da verdade do texto.
 */
export function SceneEditor({ doc, onChange }: Props) {
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  const editor = useEditor({
    extensions: sceneExtensions,
    content: doc,
    autofocus: 'end',
    editorProps: {
      attributes: { 'aria-label': 'Texto da cena', class: 'scene-text', spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getJSON() as SceneDoc, editor.getText({ blockSeparator: '\n\n' }))
    },
  })

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
    }),
  })

  return (
    <div className="scene-editor">
      <div className="toolbar" role="toolbar" aria-label="Formatação">
        <button
          type="button"
          aria-pressed={active.bold}
          title="Negrito (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <b>N</b>
        </button>
        <button
          type="button"
          aria-pressed={active.italic}
          title="Itálico (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          aria-pressed={active.strike}
          title="Tachado (Ctrl+Shift+S)"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>T</s>
        </button>
        <button
          type="button"
          title="Separador de cena (ou digite --- numa linha vazia)"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          * * *
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
