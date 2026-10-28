import { Archive, FileUp, Feather, Inbox as InboxIcon, Lightbulb, RotateCcw, ScanSearch, Trash2, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { docFromParagraphs } from '../model/sample'
import { findCandidates } from '../logic/detection'
import { KIND_LABEL } from '../model/labels'
import { ENTITY_KINDS, type InboxItem } from '../model/schema'
import { addScene, draftEntity, draftInbox, insert, patch, remove, updateScene } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Empty, Select} from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { FactDialog } from '../ui/FactDialog'
import { modKey } from '../ui/keys'
import { PageHelp } from '../ui/PageTour'

/** Tamanho máximo de cada item vindo de arquivo; arquivos maiores viram vários itens. */
const CHUNK = 6000
const MAX_FILE = 2_000_000

const SOURCE_LABEL: Record<InboxItem['source'], string> = { captura: 'Captura', arquivo: 'Arquivo', sessao: 'Sessão de jogo' }
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function InboxView() {
  const { universe, update, toast } = useWorkspace()
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<InboxItem['status']>('aberto')
  const fileRef = useRef<HTMLInputElement>(null)
  const items = universe.inbox.filter((i) => i.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const importFiles = async (files: FileList) => {
    let count = 0
    for (const file of files) {
      if (file.size > MAX_FILE) {
        toast(`“${file.name}” é grande demais (máx. 2 MB).`, { tone: 'erro' })
        continue
      }
      const content = (await file.text()).replace(/\r\n/g, '\n').trim()
      const chunks = splitChunks(content)
      update((u) => chunks.reduce((acc, c, i) => insert(acc, 'inbox', draftInbox(c, 'arquivo', chunks.length > 1 ? `${file.name} (${i + 1}/${chunks.length})` : file.name))[0], u))
      count += chunks.length
    }
    if (count) toast(`${count} ${count === 1 ? 'item importado' : 'itens importados'} para Ideias`)
  }

  return (
    <div className="view inbox-view">
      <header className="view-head view-head-wide">
        <h1>Ideias</h1>
        <PageHelp tour="inbox" />
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} /> Importar .txt ou .md
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>
      <p className="muted small view-lede">
        Capturas rápidas, notas de sessão e arquivos esperam aqui. Nada vira ficha ou canon até você decidir. Captura de qualquer lugar: {modKey}+Shift+I.
      </p>

      <form
        className="inbox-capture"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          update((u) => insert(u, 'inbox', draftInbox(text.trim()))[0])
          setText('')
        }}
      >
        <label htmlFor="inbox-text" className="sr-only">
          Nova captura
        </label>
        <textarea
          id="inbox-text"
          className="input textarea"
          rows={2}
          placeholder="Anote antes que fuja…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" className="btn btn-primary">
          Guardar
        </button>
      </form>

      <div className="filter-chips" role="radiogroup" aria-label="Mostrar">
        {(
          [
            ['aberto', 'Abertos'],
            ['processado', 'Processados'],
            ['arquivado', 'Arquivados'],
          ] as const
        ).map(([s, label]) => (
          <button key={s} type="button" role="radio" aria-checked={filter === s} className="chip" onClick={() => setFilter(s)}>
            {label} <span className="muted">{universe.inbox.filter((i) => i.status === s).length}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty icon={<InboxIcon size={32} />} title={filter === 'aberto' ? 'Nenhuma ideia esperando.' : 'Nada aqui.'} />
      ) : (
        <ul className="inbox-list">
          {items.map((i) => (
            <InboxCard key={i.id} item={i} />
          ))}
        </ul>
      )}
    </div>
  )
}

function splitChunks(text: string): string[] {
  if (text.length <= CHUNK) return [text]
  const paragraphs = text.split(/\n{2,}/)
  const out: string[] = []
  let cur = ''
  for (const p of paragraphs) {
    if (cur && cur.length + p.length + 2 > CHUNK) {
      out.push(cur)
      cur = ''
    }
    cur = cur ? `${cur}\n\n${p}` : p.slice(0, CHUNK * 2)
  }
  if (cur) out.push(cur)
  return out
}

function InboxCard({ item }: { item: InboxItem }) {
  const { universe, update, toast, go, undoable } = useWorkspace()
  const [mode, setMode] = useState<'nada' | 'nomes' | 'fato'>('nada')
  const [kind, setKind] = useState('personagem')
  const done = () => update((u) => patch(u, 'inbox', item.id, { status: 'processado' }))
  const candidates = mode === 'nomes' ? findCandidates(item.text, universe.entities, universe.settings.ignoredNames) : []

  const selectionOr = (fallback: string) => {
    const sel = window.getSelection()?.toString().trim()
    return sel && item.text.includes(sel) ? sel : fallback
  }

  return (
    <li className={`inbox-item inbox-${item.status}`}>
      <div className="inbox-meta">
        <span className="badge">{SOURCE_LABEL[item.source]}</span>
        {item.sourceName && <span className="muted small">{item.sourceName}</span>}
        <span className="muted small">{dateFmt.format(new Date(item.createdAt))}</span>
      </div>
      <textarea
        className="input textarea inbox-text"
        aria-label="Texto do item"
        rows={Math.min(10, Math.max(2, item.text.split('\n').length))}
        value={item.text}
        onChange={(e) => update((u) => patch(u, 'inbox', item.id, { text: e.target.value }))}
      />
      <div className="inbox-actions">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="Usa o texto selecionado, ou a primeira linha"
          onClick={() => {
            const name = selectionOr(item.text.split('\n')[0].slice(0, 60))
            let id = ''
            update((u) => {
              const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), description: item.text === name ? '' : item.text })
              id = e.id
              return next
            })
            toast(`Ficha “${name}” criada em rascunho`, { action: { label: 'Abrir', run: () => go('fichas', id) } })
          }}
        >
          <UserPlus size={14} /> Criar ficha
        </button>
        <Select label="Tipo da ficha" value={kind} onChange={setKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            let id = ''
            update((u) => {
              const [next, s] = addScene(u, null, item.sourceName || 'De Ideias')
              id = s.id
              const paragraphs = item.text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean)
              return patch(updateScene(next, s.id, { doc: docFromParagraphs(paragraphs), text: paragraphs.join('\n\n') }), 'inbox', item.id, { status: 'processado' })
            })
            toast('Virou uma cena solta', { action: { label: 'Abrir', run: () => go('escrever', id) } })
          }}
        >
          <Feather size={14} /> Virar cena
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMode('fato')}>
          <Lightbulb size={14} /> Fato
        </button>
        <button type="button" className="btn btn-sm btn-ghost" aria-pressed={mode === 'nomes'} onClick={() => setMode(mode === 'nomes' ? 'nada' : 'nomes')}>
          <ScanSearch size={14} /> Nomes
        </button>
        <span className="inbox-actions-end">
          {item.status === 'aberto' ? (
            <>
              <button type="button" className="btn btn-sm btn-ghost" onClick={done}>
                Feito
              </button>
              <button type="button" className="btn-icon btn-sm" aria-label="Arquivar" title="Arquivar" onClick={() => update((u) => patch(u, 'inbox', item.id, { status: 'arquivado' }))}>
                <Archive size={14} />
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => update((u) => patch(u, 'inbox', item.id, { status: 'aberto' }))}>
              <RotateCcw size={14} /> Reabrir
            </button>
          )}
          <ConfirmButton className="btn-icon btn-sm" title="Apagar" question="Apagar?" confirmLabel="Apagar" onConfirm={() => undoable('Item apagado', (u) => remove(u, 'inbox', item.id))}>
            <Trash2 size={14} aria-label="Apagar item" />
          </ConfirmButton>
        </span>
      </div>
      {mode === 'nomes' && (
        <div className="inbox-names">
          {candidates.length === 0 ? (
            <p className="muted small">Nenhum nome novo encontrado neste texto.</p>
          ) : (
            <div className="chips">
              {candidates.map((c) => (
                <button
                  key={c.text}
                  type="button"
                  className="chip"
                  title={`Criar ficha (${KIND_LABEL[kind] ?? kind})`}
                  onClick={() => {
                    update((u) => insert(u, 'entities', draftEntity(kind, c.text))[0])
                    toast(`Ficha “${c.text}” criada`)
                  }}
                >
                  + {c.text} <span className="muted">×{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {mode === 'fato' && <FactDialog initial={{ quote: selectionOr(item.text.slice(0, 300)) }} onClose={() => setMode('nada')} />}
    </li>
  )
}
