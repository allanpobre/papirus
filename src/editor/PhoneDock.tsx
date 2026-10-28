import { useEditorState, type Editor } from '@tiptap/react'
import { Bold, BookmarkPlus, ChevronDown, Italic, Link2, MessageSquarePlus, Quote, Redo2, SeparatorHorizontal, Sparkles, Undo2, UserPlus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { SceneEditorActions, SelectionInfo } from './SceneEditor'

/** Quanto o teclado do celular cobre a página (pela área visível do navegador). */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

/** Toque num botão da barra sem tirar o foco do texto (o teclado não fecha). */
const keep = (e: { preventDefault: () => void }) => e.preventDefault()

function DockButton({ label, onClick, pressed, children, wide }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <button type="button" className={wide ? 'dock-btn dock-btn-wide' : 'dock-btn'} aria-label={label} title={label} aria-pressed={pressed} onPointerDown={keep} onMouseDown={keep} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * No celular, a barra fica presa logo acima do teclado, e não por cima do texto
 * (onde brigaria com o "copiar, selecionar tudo" do próprio celular).
 * Sem seleção: formatação, travessão para falas, desfazer. Com seleção: ficha, fato, comentar…
 */
export function PhoneDock({ editor, actions, selection }: { editor: Editor; actions: SceneEditorActions; selection: () => SelectionInfo }) {
  const inset = useKeyboardInset()
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      empty: editor.state.selection.empty,
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      quote: editor.isActive('blockquote'),
      mention: editor.isActive('mention'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })
  const [focused, setFocused] = useState(editor.isFocused)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocus = () => {
      clearTimeout(timer)
      setFocused(true)
    }
    // Um instante de folga: o toque num botão da barra não pode fazê-la sumir antes do clique.
    const onBlur = () => {
      timer = setTimeout(() => setFocused(false), 150)
    }
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    return () => {
      clearTimeout(timer)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
    }
  }, [editor])

  // Escrevendo no celular: o menu de baixo some para dar espaço ao texto.
  useEffect(() => {
    document.body.classList.toggle('escrevendo-no-celular', focused)
    return () => document.body.classList.remove('escrevendo-no-celular')
  }, [focused])

  if (!focused || !editor.isEditable) return null
  const chain = () => editor.chain().focus()

  return (
    <div className="phone-dock" role="toolbar" aria-label={state.empty ? 'Formatação' : 'Ações da seleção'} style={{ bottom: inset }}>
      {state.empty ? (
        <>
          <DockButton label="Travessão (fala)" onClick={() => chain().insertContent('— ').run()} wide>
            —
          </DockButton>
          <DockButton label="Negrito" pressed={state.bold} onClick={() => chain().toggleBold().run()}>
            <Bold size={18} />
          </DockButton>
          <DockButton label="Itálico" pressed={state.italic} onClick={() => chain().toggleItalic().run()}>
            <Italic size={18} />
          </DockButton>
          <DockButton label="Citação" pressed={state.quote} onClick={() => chain().toggleBlockquote().run()}>
            <Quote size={18} />
          </DockButton>
          <DockButton label="Separador de cena" onClick={() => chain().setHorizontalRule().run()}>
            <SeparatorHorizontal size={18} />
          </DockButton>
          <span className="dock-space" />
          <DockButton label="Desfazer" onClick={() => state.canUndo && chain().undo().run()}>
            <Undo2 size={18} />
          </DockButton>
          <DockButton label="Refazer" onClick={() => state.canRedo && chain().redo().run()}>
            <Redo2 size={18} />
          </DockButton>
          <DockButton label="Fechar o teclado" onClick={() => editor.commands.blur()}>
            <ChevronDown size={18} />
          </DockButton>
        </>
      ) : (
        <>
          <DockButton label="Fato" onClick={() => actions.capture(selection())} wide>
            <Sparkles size={16} /> Fato
          </DockButton>
          <DockButton label="Ficha" onClick={() => actions.createEntity(selection())} wide>
            <UserPlus size={16} /> Ficha
          </DockButton>
          {state.mention ? (
            <DockButton label="Desvincular" onClick={() => chain().unsetMention().run()} wide>
              <Link2 size={16} /> Desvincular
            </DockButton>
          ) : (
            <DockButton label="Vincular" onClick={() => actions.link(selection())} wide>
              <Link2 size={16} /> Vincular
            </DockButton>
          )}
          <DockButton label="Comentar" onClick={() => actions.comment(selection())} wide>
            <MessageSquarePlus size={16} /> Comentar
          </DockButton>
          <DockButton label="Guardar em Ideias" onClick={() => actions.keep(selection())} wide>
            <BookmarkPlus size={16} /> Guardar
          </DockButton>
          <DockButton label="Negrito" pressed={state.bold} onClick={() => chain().toggleBold().run()}>
            <Bold size={18} />
          </DockButton>
          <DockButton label="Itálico" pressed={state.italic} onClick={() => chain().toggleItalic().run()}>
            <Italic size={18} />
          </DockButton>
        </>
      )}
    </div>
  )
}
