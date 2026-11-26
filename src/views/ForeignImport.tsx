import { FileUp, Import } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ForeignFile, ForeignWorld } from '../import/foreignWorld'
import { kindLabel, kindPlural } from '../model/labels'
import { useWorkspace } from '../state/workspace'

const IMAGE = /\.(png|jpe?g|webp|gif)$/i
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

/**
 * Trazer um mundo de outro app: Obsidian (notas .md ou o cofre em .zip), Kanka e World Anvil
 * (exportações em JSON ou .zip). Mostra o que achou antes de trazer; nada é apagado.
 */
export function ForeignImport({ onDone }: { onDone?: () => void }) {
  const { update, toast, readOnly, showAllParts } = useWorkspace()
  const input = useRef<HTMLInputElement>(null)
  const [found, setFound] = useState<ForeignWorld | null>(null)
  const [busy, setBusy] = useState(false)

  const read = async (files: File[]) => {
    setBusy(true)
    try {
      const { readForeign, unzipText } = await import('../import/foreignWorld')
      const all: ForeignFile[] = []
      for (const f of files) {
        const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
        if (/\.zip$/i.test(f.name)) all.push(...unzipText(f.name, new Uint8Array(await f.arrayBuffer())))
        else if (IMAGE.test(f.name)) all.push({ path, text: '', bytes: new Uint8Array(await f.arrayBuffer()) })
        else all.push({ path, text: await f.text() })
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
    // As imagens das notas (retratos) vão para o aparelho antes; se alguma falhar, a ficha vem sem ela.
    let withImage = 0
    const entities = await Promise.all(
      found.entities.map(async (e) => {
        if (!e.imageFile) return e
        try {
          const { addImage } = await import('../images/add')
          const ext = e.imageFile.name.split('.').pop()?.toLowerCase() ?? 'png'
          const { ref } = await addImage(new Blob([e.imageFile.bytes.slice().buffer], { type: MIME[ext] ?? 'image/png' }), 'retrato')
          withImage++
          return { ...e, imageRef: ref }
        } catch {
          return e
        }
      }),
    )
    let created = 0
    let existing = 0
    update((u) => {
      const out = applyForeign(u, { ...found, entities })
      created = out.created
      existing = out.existing
      return out.universe
    })
    toast(`${created} ${created === 1 ? 'ficha trazida' : 'fichas trazidas'}${withImage ? `, ${withImage} com imagem` : ''}${existing ? `; ${existing} já existiam e ficaram como estavam` : ''}.`)
    // Quem chega com um mundo pronto vê todas as partes do Mundo desde já (auditoria 26, Duda): a Linha do tempo e os
    // Mapas não ficam escondidos esperando o primeiro uso, como na primeira vez de quem começa do zero.
    showAllParts()
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
        accept=".md,.markdown,.txt,.json,.zip,.png,.jpg,.jpeg,.webp,.gif"
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
            {byKind.map(([k, n]) => `${n} ${(n === 1 ? kindLabel(k) : kindPlural(k)).toLocaleLowerCase('pt-BR')}`).join(', ')}.
            {found.entities.some((e) => e.secret) && (
              <span> {found.entities.filter((e) => e.secret).length} {found.entities.filter((e) => e.secret).length === 1 ? 'era privada' : 'eram privadas'} no outro app e {found.entities.filter((e) => e.secret).length === 1 ? 'vira' : 'viram'} segredo aqui.</span>
            )}
            {found.entities.some((e) => e.imageFile) && <span> {found.entities.filter((e) => e.imageFile).length} com imagem.</span>}
            {found.skipped > 0 && <span className="muted"> {found.skipped} arquivos ficaram de fora (moldes, configurações, imagens que nenhuma nota usa ou repetidos).</span>}
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
