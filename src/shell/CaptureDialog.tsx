import { useState } from 'react'
import { draftInbox, insert } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'
import { modKey } from '../ui/keys'

/** Captura rápida para Ideias, de qualquer lugar (Ctrl/⌘+Shift+I). */
export function CaptureDialog({ onClose }: { onClose: () => void }) {
  const { update, toast } = useWorkspace()
  const [text, setText] = useState('')

  const save = () => {
    if (!text.trim()) return onClose()
    update((u) => insert(u, 'inbox', draftInbox(text.trim()))[0])
    toast('Guardado em Ideias')
    onClose()
  }

  return (
    <Modal
      title="Capturar uma ideia"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <span className="muted small">{modKey}+Enter guarda</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Guardar em Ideias
          </button>
        </>
      }
    >
      <label htmlFor="captura" className="sr-only">
        Ideia
      </label>
      <textarea
        id="captura"
        className="input textarea"
        rows={5}
        autoFocus
        placeholder="Um nome, uma cena, uma dúvida… organize depois."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
          }
        }}
      />
    </Modal>
  )
}
