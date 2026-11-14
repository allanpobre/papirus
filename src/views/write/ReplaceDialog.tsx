import { useDeferredValue, useMemo, useState } from 'react'
import { findInBook, replaceInBook, splitHitsByBook, type FindOptions, type Hit } from '../../editor/replace'
import { byId } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Modal } from '../../ui/Modal'
import type { ReplaceRequest } from './replaceEvents'

/** Quantos achados aparecem na lista (a troca vale para todos os marcados, mesmo os que não aparecem). */
const SHOWN = 400

/**
 * Procurar e trocar no livro todo: títulos e textos das cenas. Antes de trocar, a lista mostra cada
 * trecho para desmarcar o que não deve mudar. Guarda um snapshot antes e dá para desfazer.
 */
export function ReplaceDialog({ initial, onClose }: { initial: ReplaceRequest; onClose: () => void }) {
  const { universe, update, toast, repo, go, readOnly, bookId } = useWorkspace()
  const book = bookId ? byId(universe, 'stories', bookId) : undefined
  // Com um livro escolhido no alto, procura só nele (e mostra quantos achados há em todos os livros).
  const [scope, setScope] = useState<'livro' | 'todos'>('livro')
  const [find, setFind] = useState(initial.find ?? '')
  const [replacement, setReplacement] = useState(initial.replace ?? '')
  const [opts, setOpts] = useState<FindOptions>({ wholeWord: false, matchCase: false, ...initial.opts })
  const query = useDeferredValue(find)
  const found = useMemo(() => splitHitsByBook(universe, findInBook(universe, query, opts), book ? book.id : null), [universe, query, opts, book])
  const hits = book && scope === 'livro' ? found.book : found.all
  // O que foi desmarcado vale só para esta busca: mudou a busca, tudo volta marcado.
  const signature = `${query}\u0000${opts.wholeWord}${opts.matchCase}${scope}`
  const [off, setOff] = useState<{ signature: string; keys: Set<string> }>({ signature, keys: new Set() })
  const unchecked = off.signature === signature ? off.keys : new Set<string>()
  const chosen = hits.filter((h) => !unchecked.has(h.key))
  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(unchecked)
    for (const k of keys) {
      if (on) next.delete(k)
      else next.add(k)
    }
    setOff({ signature, keys: next })
  }

  const groups = useMemo(() => {
    const out: { sceneId: string; hits: Hit[] }[] = []
    for (const h of hits.slice(0, SHOWN)) {
      const last = out[out.length - 1]
      if (last?.sceneId === h.sceneId) last.hits.push(h)
      else out.push({ sceneId: h.sceneId, hits: [h] })
    }
    return out
  }, [hits])
  const sceneCount = new Set(hits.map((h) => h.sceneId)).size
  const same = replacement === find && opts.matchCase

  const run = () => {
    const keys = new Set(chosen.map((h) => h.key))
    const label = `trocar “${find}” por “${replacement}”`
    void repo.createSnapshot(universe, `Antes de ${label}`).catch(() => undefined)
    const result = replaceInBook(universe, find, replacement, opts, keys)
    if (!result.count) return onClose()
    // Desfazer volta só as cenas que mudaram (o que foi escrito depois em outras cenas fica).
    const before = new Map(universe.scenes.filter((sc) => result.sceneIds.includes(sc.id)).map((sc) => [sc.id, sc]))
    update((u) => replaceInBook(u, find, replacement, opts, keys).universe)
    const n = result.count
    toast(`${n === 1 ? '1 troca' : `${n} trocas`}: “${find}” → “${replacement || '(nada)'}”`, {
      action: {
        label: 'Desfazer',
        run: () => {
          const stamp = new Date().toISOString()
          update((u) => ({ ...u, scenes: u.scenes.map((sc) => (before.has(sc.id) ? { ...before.get(sc.id)!, updatedAt: stamp } : sc)), updatedAt: stamp }))
        },
      },
    })
    onClose()
  }

  return (
    <Modal
      title="Procurar e trocar no livro"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="muted small replace-foot-note">Antes, um snapshot é guardado. Depois, dá para desfazer.</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={readOnly || !find || chosen.length === 0 || same} onClick={run}>
            {chosen.length === 0 ? 'Trocar' : `Trocar ${chosen.length}`}
          </button>
        </>
      }
    >
      <div className="replace-fields">
        <label className="replace-field">
          <span className="field-label">Procurar</span>
          <input className="input" value={find} autoFocus onChange={(e) => setFind(e.target.value)} placeholder="Ex.: Kael" />
        </label>
        <label className="replace-field">
          <span className="field-label">Trocar por</span>
          <input className="input" value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Vazio apaga o que achar" />
        </label>
      </div>
      <div className="replace-opts">
        <label className="check">
          <input type="checkbox" checked={opts.wholeWord} onChange={(e) => setOpts({ ...opts, wholeWord: e.target.checked })} />
          Palavra inteira
        </label>
        <label className="check">
          <input type="checkbox" checked={opts.matchCase} onChange={(e) => setOpts({ ...opts, matchCase: e.target.checked })} />
          Maiúsculas iguais
        </label>
        <span className="muted tiny">Procura nos títulos e no texto das cenas. Fichas e notas não mudam.</span>
      </div>
      {book && (
        <div className="replace-scope" role="radiogroup" aria-label="Onde procurar">
          {(
            [
              ['livro', `Só neste livro (${found.book.length})`],
              ['todos', `Em todos os livros (${found.all.length})`],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="check">
              <input type="radio" name="replace-scope" checked={scope === value} onChange={() => setScope(value)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {query && (
        <div className="replace-results" aria-live="polite">
          <div className="replace-summary">
            <strong>{hits.length === 0 ? 'Nada encontrado.' : `${hits.length} ${hits.length === 1 ? 'achado' : 'achados'} em ${sceneCount} ${sceneCount === 1 ? 'cena' : 'cenas'}`}</strong>
            {hits.length > 1 && (
              <span className="replace-all">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    toggle(
                      hits.map((h) => h.key),
                      true,
                    )
                  }
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    toggle(
                      hits.map((h) => h.key),
                      false,
                    )
                  }
                >
                  Desmarcar todos
                </button>
              </span>
            )}
          </div>
          {groups.map((g) => {
            const scene = byId(universe, 'scenes', g.sceneId)
            const story = scene?.storyId ? byId(universe, 'stories', scene.storyId) : undefined
            const allOn = g.hits.every((h) => !unchecked.has(h.key))
            return (
              <section key={g.sceneId} className="replace-scene" aria-label={scene?.title || 'Sem título'}>
                <header className="replace-scene-head">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={allOn}
                      onChange={(e) =>
                        toggle(
                          g.hits.map((h) => h.key),
                          e.target.checked,
                        )
                      }
                    />
                    <strong>{scene?.title || 'Sem título'}</strong>
                  </label>
                  <span className="muted tiny">{story ? story.title || 'Sem título' : 'Sem capítulo'}</span>
                  <button
                    type="button"
                    className="link-btn tiny replace-open"
                    onClick={() => {
                      onClose()
                      go('escrever', g.sceneId)
                    }}
                  >
                    Abrir
                  </button>
                </header>
                <ul className="replace-hits">
                  {g.hits.map((h) => (
                    <li key={h.key}>
                      <label className="replace-hit">
                        <input type="checkbox" checked={!unchecked.has(h.key)} onChange={(e) => toggle([h.key], e.target.checked)} />
                        <span>
                          {h.where === 'titulo' && <span className="replace-where">Título: </span>}
                          {h.before}
                          <mark className={unchecked.has(h.key) ? 'is-off' : undefined}>{h.match}</mark>
                          {!unchecked.has(h.key) && <ins>{replacement}</ins>}
                          {h.after}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {hits.length > SHOWN && <p className="muted small">E mais {hits.length - SHOWN}. Todos os marcados entram na troca.</p>}
        </div>
      )}
    </Modal>
  )
}
