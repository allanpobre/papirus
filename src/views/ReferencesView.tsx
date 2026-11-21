import { BookMarked, ExternalLink, Image as ImageIcon, Link2, Lock, Plus, Quote, Trash2 } from 'lucide-react'
import { useState, type ClipboardEvent, type DragEvent } from 'react'
import { ImageButtons, Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import type { Entity } from '../model/schema'
import { newId, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/*
 * Referências (como um mural do Pinterest, do Milanote ou do PureRef): o que inspirou a ficha. Cada uma diz o
 * que se pegou dela e o que ela não é. São só do autor: não vão para a wiki, o leitor nem o link de leitura.
 */

type Reference = NonNullable<Entity['refs']>[number]

/** O que dá para pegar de uma referência. */
const TOOK = ['aparência', 'voz', 'jeito de falar', 'personalidade', 'história', 'poder', 'nome', 'lugar', 'clima'] as const

const KIND_LABEL: Record<Reference['kind'], string> = { imagem: 'Imagem', link: 'Link', trecho: 'Trecho', obra: 'Outra obra' }

/** Só endereços da web viram link (nada de "javascript:"). */
const safeUrl = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : null)

/** Ler (só o autor): o mural. */
export function ReferencesReader({ entity }: { entity: Entity }) {
  const refs = entity.refs ?? []
  if (!refs.length) return null
  return (
    <section className="refs-read" aria-label="Referências">
      <h2>
        Referências <span className="refs-private muted small"><Lock size={12} aria-hidden="true" /> só você vê</span>
      </h2>
      <ul className="refs-wall">
        {refs.map((r) => (
          <li key={r.id} className={`ref-card is-${r.kind}`}>
            {r.kind === 'imagem' && r.image && <Picture value={r.image} alt={r.title || 'Referência'} className="ref-image" />}
            {r.title && <strong className="ref-title">{r.title}</strong>}
            {r.kind === 'link' && (safeUrl(r.url) ? (
              <a className="ref-link small" href={safeUrl(r.url)!} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={12} aria-hidden="true" /> {r.url.replace(/^https?:\/\//, '').slice(0, 40)}
              </a>
            ) : r.url ? (
              <span className="small muted">{r.url}</span>
            ) : null)}
            {r.text && (r.kind === 'trecho' ? <blockquote className="ref-quote">{r.text}</blockquote> : <p className="small">{r.text}</p>)}
            {r.took.length > 0 && (
              <p className="ref-took">
                {r.took.map((t) => (
                  <span key={t} className="chip chip-sm">
                    {t}
                  </span>
                ))}
              </p>
            )}
            {r.notThis && <p className="ref-not small muted">Não é: {r.notThis}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Editar: o mural, com o que se pegou de cada referência e o que ela não é. */
export function ReferencesEditor({ entity: e }: { entity: Entity }) {
  const { update, toast, readOnly } = useWorkspace()
  const refs = e.refs ?? []
  const save = (next: Reference[]) => update((u) => patch(u, 'entities', e.id, { refs: next.length ? next : undefined }))
  const change = (id: string, changes: Partial<Reference>) => save(refs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  const add = (kind: Reference['kind'], image: string | null = null) => save([...refs, { id: newId(), kind, title: '', image, url: '', text: '', took: [], notThis: '' }])
  const picker = useImagePicker('cena', (ref) => add('imagem', ref), (m) => toast(m, { tone: 'erro' }))

  return (
    <div className="refs-edit">
      <p className="muted small">
        <Lock size={12} aria-hidden="true" /> Só você vê. O que inspirou {e.name || 'esta ficha'}: imagens, links, trechos, personagens de outras obras. Diga o que pegou de cada uma (e o que ela não é).
      </p>
      {refs.map((r) => (
        <fieldset key={r.id} className={`ref-card is-${r.kind}`} disabled={readOnly}>
          <legend className="small">{KIND_LABEL[r.kind]}</legend>
          {r.kind === 'imagem' && (
            <>
              {r.image && <Picture value={r.image} alt={r.title || 'Referência'} className="ref-image" />}
              <ImageButtons value={r.image} use="cena" onChange={(ref) => change(r.id, { image: ref })} onError={(m) => toast(m, { tone: 'erro' })} chooseLabel="Trocar a imagem" />
            </>
          )}
          <input className="input input-sm" aria-label="Título da referência" placeholder={r.kind === 'obra' ? 'Quem ou o quê (ex.: Arya Stark)' : 'Título (opcional)'} value={r.title} onChange={(ev) => change(r.id, { title: ev.target.value })} />
          {r.kind === 'link' && <input className="input input-sm" type="url" aria-label="Endereço" placeholder="https://…" value={r.url} onChange={(ev) => change(r.id, { url: ev.target.value })} />}
          {(r.kind === 'trecho' || r.kind === 'obra') && (
            <textarea
              className="input textarea"
              rows={2}
              aria-label={r.kind === 'trecho' ? 'O trecho' : 'O que lembra'}
              placeholder={r.kind === 'trecho' ? 'Cole a frase ou o trecho' : 'O que dela está aqui'}
              value={r.text}
              onChange={(ev) => change(r.id, { text: ev.target.value })}
            />
          )}
          <div className="ref-took-edit" role="group" aria-label="O que peguei daqui">
            {TOOK.map((t) => (
              <button
                key={t}
                type="button"
                className="chip chip-sm"
                aria-pressed={r.took.includes(t)}
                onClick={() => change(r.id, { took: r.took.includes(t) ? r.took.filter((x) => x !== t) : [...r.took, t] })}
              >
                {t}
              </button>
            ))}
          </div>
          <input className="input input-sm" aria-label="O que não é" placeholder="O que não é (para não copiar demais)" value={r.notThis} onChange={(ev) => change(r.id, { notThis: ev.target.value })} />
          <button type="button" className="btn btn-ghost btn-sm ref-remove" onClick={() => save(refs.filter((x) => x.id !== r.id))}>
            <Trash2 size={14} aria-hidden="true" /> Tirar
          </button>
        </fieldset>
      ))}
      {!readOnly && (
        <div className="refs-add" role="group" aria-label="Nova referência">
          {picker.field}
          <button type="button" className="btn btn-sm" disabled={picker.busy} onClick={picker.open}>
            <ImageIcon size={14} aria-hidden="true" /> Imagem
          </button>
          <button type="button" className="btn btn-sm" onClick={() => add('link')}>
            <Link2 size={14} aria-hidden="true" /> Link
          </button>
          <button type="button" className="btn btn-sm" onClick={() => add('trecho')}>
            <Quote size={14} aria-hidden="true" /> Trecho
          </button>
          <button type="button" className="btn btn-sm" onClick={() => add('obra')}>
            <BookMarked size={14} aria-hidden="true" /> Outra obra
          </button>
        </div>
      )}
    </div>
  )
}

const KIND_ICON = { imagem: ImageIcon, link: Link2, trecho: Quote, obra: BookMarked } as const

/** O que alguém colou vira uma referência: endereço é link, frase longa é trecho, o resto é outra obra ("Arya Stark"). */
export function guessRef(text: string): Pick<Reference, 'kind' | 'title' | 'url' | 'text'> | null {
  const t = text.trim()
  if (!t) return null
  if (/^https?:\/\/\S+$/i.test(t)) return { kind: 'link', title: '', url: t, text: '' }
  if (t.length > 40 || /^["“«]/.test(t)) return { kind: 'trecho', title: '', url: '', text: t.replace(/^["“«]|["”»]$/g, '') }
  return { kind: 'obra', title: t, url: '', text: '' }
}

/**
 * A faixa de referências no alto da ficha (só o autor): as imagens e o resto em miniatura, e um "+" que aceita
 * colar um link, um trecho, um nome de outra obra ou uma imagem (colada ou solta). Tocar numa abre em grande.
 */
export function RefsStrip({ entity: e }: { entity: Entity }) {
  const { update, toast, readOnly } = useWorkspace()
  const refs = e.refs ?? []
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [open, setOpen] = useState<Reference | null>(null)
  const save = (next: Reference[]) => update((u) => patch(u, 'entities', e.id, { refs: next.length ? next : undefined }))
  const blank = (): Reference => ({ id: newId(), kind: 'trecho', title: '', image: null, url: '', text: '', took: [], notThis: '' })
  const picker = useImagePicker('cena', (ref) => save([...(e.refs ?? []), { ...blank(), kind: 'imagem', image: ref }]), (m) => toast(m, { tone: 'erro' }))
  if (readOnly && !refs.length) return null

  const addText = () => {
    const g = guessRef(text)
    if (!g) return
    save([...refs, { ...blank(), ...g }])
    setText('')
  }
  const images = (files: Iterable<File>) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    for (const f of list) void picker.take(f)
    return list.length > 0
  }
  const onPaste = (ev: ClipboardEvent) => {
    if (images(Array.from(ev.clipboardData.files))) ev.preventDefault()
  }
  const onDrop = (ev: DragEvent) => {
    if (readOnly) return
    ev.preventDefault()
    images(Array.from(ev.dataTransfer.files))
  }

  return (
    <section className={`refs-strip${refs.length ? '' : ' is-empty'}`} aria-label="Referências desta ficha" onDragOver={(ev) => ev.preventDefault()} onDrop={onDrop}>
      <p className="refs-strip-head small">
        <strong>Referências</strong>
        <span className="muted">
          <Lock size={11} aria-hidden="true" /> só você vê
        </span>
        {!refs.length && <span className="muted refs-strip-hint">O que inspira {e.name || 'esta ficha'}: imagens, links, frases, outras obras.</span>}
      </p>
      <ul className="refs-strip-row">
        {refs.map((r) => {
          const Icon = KIND_ICON[r.kind]
          return (
            <li key={r.id}>
              <button type="button" className={`ref-tile is-${r.kind}`} onClick={() => setOpen(r)} aria-label={`Abrir referência: ${r.title || r.text.slice(0, 30) || r.url || KIND_LABEL[r.kind]}`}>
                {r.kind === 'imagem' && r.image ? (
                  <Picture value={r.image} alt="" className="ref-tile-img" />
                ) : (
                  <>
                    <Icon size={14} aria-hidden="true" />
                    <span className="ref-tile-text">{r.title || r.text || r.url.replace(/^https?:\/\//, '') || KIND_LABEL[r.kind]}</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
        {!readOnly && (
          <li>
            <button type="button" className="ref-tile ref-tile-add" aria-expanded={adding} aria-label="Nova referência" onClick={() => setAdding((v) => !v)}>
              <Plus size={20} aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
      {adding && !readOnly && (
        <div className="refs-quick" role="group" aria-label="Nova referência">
          {picker.field}
          <input
            className="input input-sm"
            aria-label="Colar uma referência"
            placeholder="Cole um link, uma frase, um nome de outra obra… ou uma imagem"
            value={text}
            autoFocus
            onChange={(ev) => setText(ev.target.value)}
            onPaste={onPaste}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                addText()
              }
            }}
          />
          <div className="refs-quick-actions">
            <button type="button" className="btn btn-sm" disabled={picker.busy} onClick={picker.open}>
              <ImageIcon size={14} aria-hidden="true" /> Imagem
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={addText}>
              Guardar
            </button>
          </div>
        </div>
      )}
      {open && (
        <Modal title={open.title || KIND_LABEL[open.kind]} onClose={() => setOpen(null)}>
          <div className={`ref-card ref-open is-${open.kind}`}>
            {open.kind === 'imagem' && open.image && <Picture value={open.image} alt={open.title || 'Referência'} className="ref-image" />}
            {open.kind === 'link' && safeUrl(open.url) && (
              <a className="ref-link" href={safeUrl(open.url)!} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} aria-hidden="true" /> {open.url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {open.text && (open.kind === 'trecho' ? <blockquote className="ref-quote">{open.text}</blockquote> : <p>{open.text}</p>)}
            {!readOnly && (
              <div className="ref-took-edit" role="group" aria-label="O que peguei daqui">
                {TOOK.map((t) => {
                  const cur = (e.refs ?? []).find((x) => x.id === open.id) ?? open
                  const on = cur.took.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className="chip chip-sm"
                      aria-pressed={on}
                      onClick={() => {
                        const took = on ? cur.took.filter((x) => x !== t) : [...cur.took, t]
                        save((e.refs ?? []).map((x) => (x.id === open.id ? { ...x, took } : x)))
                        setOpen({ ...cur, took })
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            )}
            {open.notThis && <p className="ref-not small muted">Não é: {open.notThis}</p>}
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost btn-sm ref-remove"
                onClick={() => {
                  save((e.refs ?? []).filter((x) => x.id !== open.id))
                  setOpen(null)
                }}
              >
                <Trash2 size={14} aria-hidden="true" /> Tirar
              </button>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}
