import type { Editor } from '@tiptap/react'
import { BookOpenText, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { findInDoc, followCase, type DocHit, type FindOptions } from '../../editor/find'
import { useWorkspace } from '../../state/workspace'
import { openBookReplace } from './replaceEvents'

/**
 * Procurar (e trocar) na cena aberta, com o Ctrl+F. Os achados ficam destacados no texto;
 * Enter vai para o próximo. "No livro todo" abre a busca em todas as cenas.
 */
export function FindBar({ editor, initial, phone, onClose }: { editor: Editor | null; initial: string; phone: boolean; onClose: () => void }) {
  const { toast, readOnly } = useWorkspace()
  const [query, setQuery] = useState(initial)
  const [replacement, setReplacement] = useState('')
  const [opts, setOpts] = useState<FindOptions>({ wholeWord: false, matchCase: false })
  const [current, setCurrent] = useState(0)
  const [hits, setHits] = useState<DocHit[]>([])
  const [replacing, setReplacing] = useState(!phone)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  // Conta de novo a cada mudança no texto.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const count = () => setHits(findInDoc(editor.state.doc, query, opts))
    count()
    editor.on('update', count)
    return () => {
      editor.off('update', count)
    }
  }, [editor, query, opts])

  const at = hits.length ? Math.min(current, hits.length - 1) : 0
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setSearch(query ? { query, opts, current: at } : null)
  }, [editor, query, opts, at])
  // Fechou: o destaque some.
  useEffect(
    () => () => {
      if (editor && !editor.isDestroyed) editor.commands.setSearch(null)
    },
    [editor],
  )

  const reveal = (hit: DocHit | undefined) => {
    if (!hit || !editor || editor.isDestroyed) return
    const { node } = editor.view.domAtPos(hit.from)
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const go = (step: 1 | -1) => {
    if (!hits.length) return
    const i = (at + step + hits.length) % hits.length
    setCurrent(i)
    reveal(hits[i])
  }

  const replaceOne = () => {
    const hit = hits[at]
    if (!hit || !editor || editor.isDestroyed) return
    const text = followCase(editor.state.doc.textBetween(hit.from, hit.to), replacement, opts)
    editor
      .chain()
      .command(({ tr, state }) => {
        if (!text) tr.delete(hit.from, hit.to)
        else tr.replaceWith(hit.from, hit.to, state.schema.text(text, state.doc.nodeAt(hit.from)?.marks ?? []))
        return true
      })
      .run()
    // O próximo é o primeiro depois do que entrou (se o que entrou contém a busca, não troca de novo).
    const after = findInDoc(editor.state.doc, query, opts)
    const next = after.findIndex((h) => h.from >= hit.from + text.length)
    setCurrent(next < 0 ? 0 : next)
    reveal(after[next < 0 ? 0 : next])
  }

  const replaceAll = () => {
    if (!hits.length || !editor || editor.isDestroyed) return
    const n = hits.length
    editor
      .chain()
      .command(({ tr, state }) => {
        for (const hit of [...hits].reverse()) {
          const text = followCase(state.doc.textBetween(hit.from, hit.to), replacement, opts)
          if (!text) tr.delete(hit.from, hit.to)
          else tr.replaceWith(hit.from, hit.to, state.schema.text(text, state.doc.nodeAt(hit.from)?.marks ?? []))
        }
        return true
      })
      .run()
    toast(n === 1 ? '1 troca nesta cena' : `${n} trocas nesta cena`, {
      action: { label: 'Desfazer', run: () => !editor.isDestroyed && editor.commands.undo() },
    })
  }

  return (
    <div className="find-bar" role="search" aria-label="Procurar na cena">
      <div className="find-row">
        <input
          ref={input}
          className="input input-sm find-input"
          aria-label="Procurar na cena"
          placeholder="Procurar na cena"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCurrent(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              go(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <span className="find-count muted small" aria-live="polite">
          {query ? (hits.length ? `${at + 1} de ${hits.length}` : 'Nada') : ''}
        </span>
        <button type="button" className="btn-icon btn-sm" aria-label="Achado anterior" title="Anterior (Shift+Enter)" disabled={!hits.length} onClick={() => go(-1)}>
          <ChevronUp size={16} />
        </button>
        <button type="button" className="btn-icon btn-sm" aria-label="Próximo achado" title="Próximo (Enter)" disabled={!hits.length} onClick={() => go(1)}>
          <ChevronDown size={16} />
        </button>
        {phone && !readOnly && (
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={replacing} onClick={() => setReplacing(!replacing)}>
            Trocar
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm find-book"
          title="Procurar e trocar em todas as cenas"
          onClick={() => {
            onClose()
            openBookReplace({ find: query, replace: replacement, opts })
          }}
        >
          <BookOpenText size={15} aria-hidden="true" /> No livro todo
        </button>
        <button type="button" className="btn-icon btn-sm" aria-label="Fechar a busca" title="Fechar (Esc)" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {replacing && !readOnly && (
        <div className="find-row">
          <input
            className="input input-sm find-input"
            aria-label="Trocar por"
            placeholder="Trocar por"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                replaceOne()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />
          <button type="button" className="btn btn-ghost btn-sm" disabled={!hits.length} onClick={replaceOne}>
            Trocar este
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!hits.length} onClick={replaceAll}>
            Trocar todos{hits.length > 1 ? ` (${hits.length})` : ''}
          </button>
          <span className="find-opts">
            <label className="check">
              <input type="checkbox" checked={opts.wholeWord} onChange={(e) => setOpts({ ...opts, wholeWord: e.target.checked })} />
              Palavra inteira
            </label>
            <label className="check">
              <input type="checkbox" checked={opts.matchCase} onChange={(e) => setOpts({ ...opts, matchCase: e.target.checked })} />
              Maiúsculas iguais
            </label>
          </span>
        </div>
      )}
    </div>
  )
}
