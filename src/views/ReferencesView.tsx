import { BookMarked, ExternalLink, Image as ImageIcon, Link2, Lock, Quote, Trash2 } from 'lucide-react'
import { ImageButtons, Picture } from '../images/Picture'
import { useImagePicker } from '../images/useImagePicker'
import type { Entity } from '../model/schema'
import { newId, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'

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
