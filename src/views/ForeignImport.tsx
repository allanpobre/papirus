import { FileUp, Import } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ForeignWorld } from '../import/foreignWorld'
import { kindPlural } from '../model/labels'
import { useWorkspace } from '../state/workspace'

/**
 * Trazer um mundo de outro app: Obsidian (notas .md ou o cofre em .zip), Kanka e World Anvil
 * (exportações em JSON ou .zip). Mostra o que achou antes de trazer; nada é apagado.
 */
export function ForeignImport({ onDone }: { onDone?: () => void }) {
  const { update, toast, readOnly } = useWorkspace()
  const input = useRef<HTMLInputElement>(null)
  const [found, setFound] = useState<ForeignWorld | null>(null)
  const [busy, setBusy] = useState(false)

  const read = async (files: File[]) => {
    setBusy(true)
    try {
      const { readForeign, unzipText } = await import('../import/foreignWorld')
      const all = []
      for (const f of files) {
        if (/\.zip$/i.test(f.name)) all.push(...unzipText(f.name, new Uint8Array(await f.arrayBuffer())))
        else all.push({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, text: await f.text() })
      }
      const w = readForeign(all)
      if (!w.entities.length) toast('Não achei fichas nesses arquivos. Use notas .md, exportações .json ou um .zip.', { tone: 'erro' })
      setFound(w.entities.length ? w : null)
    } catch {
      toast('Não consegui ler esses arquivos.', { tone: 'erro' })
    } finally {
      setBusy(false)
    }
  }

  const bring = async () => {
    if (!found) return
    const { applyForeign } = await import('../import/foreignWorld')
    let created = 0
    let existing = 0
    update((u) => {
      const out = applyForeign(u, found)
      created = out.created
      existing = out.existing
      return out.universe
    })
    toast(`${created} ${created === 1 ? 'ficha trazida' : 'fichas trazidas'}${existing ? `; ${existing} já existiam e ficaram como estavam` : ''}.`)
    setFound(null)
    onDone?.()
  }

  const byKind = found
    ? [...found.entities.reduce((m, e) => m.set(e.kind, (m.get(e.kind) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
    : []

  return (
    <section className="settings-card foreign-import" aria-labelledby="trazer-titulo">
      <h2 id="trazer-titulo" className="section-title">
        <Import size={16} aria-hidden="true" /> Trazer de outro app
      </h2>
      <p className="small">
        Do <strong>Obsidian</strong> (notas .md ou o cofre em .zip), do <strong>Kanka</strong> ou do <strong>World Anvil</strong> (exportação em .json ou .zip). Cada nota vira uma ficha, com o tipo tirado da pasta ou da categoria; as menções viram links sozinhas.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".md,.markdown,.txt,.json,.zip"
        aria-label="Arquivos de outro app"
        onChange={(e) => {
          // Copia a lista antes de limpar o campo (limpar esvazia a lista do navegador).
          if (e.target.files?.length) void read(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      {found ? (
        <div className="foreign-found" role="status">
          <p>
            Achei <strong>{found.entities.length}</strong> {found.entities.length === 1 ? 'ficha' : 'fichas'} ({found.sources.join(', ')}):{' '}
            {byKind.map(([k, n]) => `${n} ${kindPlural(k).toLocaleLowerCase('pt-BR')}`).join(', ')}.
            {found.skipped > 0 && <span className="muted"> {found.skipped} arquivos ficaram de fora (imagens, configurações ou repetidos).</span>}
          </p>
          <div className="button-stack">
            <button type="button" className="btn btn-primary" disabled={readOnly} onClick={() => void bring()}>
              Trazer {found.entities.length} {found.entities.length === 1 ? 'ficha' : 'fichas'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setFound(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" disabled={busy || readOnly} onClick={() => input.current?.click()}>
          <FileUp size={16} aria-hidden="true" /> {busy ? 'Lendo…' : 'Escolher arquivos'}
        </button>
      )}
    </section>
  )
}
