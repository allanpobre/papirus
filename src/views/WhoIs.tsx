import { Plus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import {
  addDefiner,
  addException,
  addOption,
  choose,
  definersFor,
  definersOf,
  membersCount,
  passesOf,
  removeException,
  setPasses,
  updateDefiner,
  removeDefiner,
  whoIs,
  type Definer,
} from '../logic/definers'
import { fold } from '../logic/text'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/** Tipos em que "Quem é" aparece mesmo vazio, convidando a criar o primeiro item. */
const INVITE_KINDS = ['personagem', 'faccao', 'reino']
const EXAMPLES: Record<string, string> = {
  personagem: 'espécie, corpo ciborgue, a lua em que nasceu…',
  faccao: 'ideologia, origem, tamanho…',
  reino: 'regime, clima, religião oficial…',
}
const NEW = '__nova'

/**
 * "Quem é" no Editar de uma ficha: uma escolha para cada item que define este tipo neste mundo
 * (Espécie, Corpo, Lua…), o que vem com a opção e as exceções desta ficha.
 */
export function WhoIsEditor({ entity: e }: { entity: Entity }) {
  const { universe, update, go, readOnly } = useWorkspace()
  const rows = whoIs(universe, e)
  const others = definersOf(universe).filter((d) => !d.appliesTo.includes(e.kind))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [newOption, setNewOption] = useState<{ definer: string; name: string } | null>(null)
  if (!rows.length && !INVITE_KINDS.includes(e.kind) && !others.length) return null

  const setFields = (fields: Entity['fields']) => update((u) => patch(u, 'entities', e.id, { fields }))
  const create = () => {
    const clean = name.trim()
    if (!clean) return
    const same = definersOf(universe).find((d) => fold(d.name) === fold(clean))
    update((u) => (same ? updateDefiner(u, same.id, { appliesTo: [...same.appliesTo, e.kind] }) : addDefiner(u, clean, [e.kind])[0]))
    setName('')
    setAdding(false)
  }
  const createOption = (d: Definer, optionName: string) => {
    if (!optionName.trim()) return
    update((u) => {
      const [next, id] = addOption(u, d, optionName)
      return choose(next, e.id, d, id)
    })
    setNewOption(null)
  }

  return (
    <section className="whois" aria-labelledby={`whois-${e.id}`}>
      <h2 id={`whois-${e.id}`} className="section-title">
        <Sparkles size={15} aria-hidden="true" /> Quem é
      </h2>
      {!rows.length && (
        <p className="muted small">
          O que define {kindLabel(e.kind).toLowerCase()} neste mundo? Ex.: {EXAMPLES[e.kind] ?? 'origem, natureza…'} Cada opção passa as características dela, e a ficha pode ser exceção.
        </p>
      )}
      {rows.map(({ definer: d, option, traits }) => (
        <div key={d.id} className="whois-item">
          <div className="whois-pick">
            <label className="field-label whois-label" htmlFor={`whois-${e.id}-${d.id}`}>
              {d.name}
            </label>
            {newOption?.definer === d.id ? (
              <form
                className="inline-fields"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  createOption(d, newOption.name)
                }}
              >
                <input
                  className="input"
                  autoFocus
                  aria-label={`Nova opção de ${d.name}`}
                  placeholder={`Nome (ex.: ${d.kind === 'especie' ? 'Elfo' : 'Lua cheia'})`}
                  value={newOption.name}
                  onChange={(ev) => setNewOption({ definer: d.id, name: ev.target.value })}
                />
                <button type="submit" className="btn btn-sm btn-primary" disabled={!newOption.name.trim()}>
                  Criar
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNewOption(null)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <select
                id={`whois-${e.id}-${d.id}`}
                className="input select"
                disabled={readOnly}
                value={option?.id ?? ''}
                onChange={(ev) => {
                  const v = ev.target.value
                  if (v === NEW) setNewOption({ definer: d.id, name: '' })
                  else update((u) => choose(u, e.id, d, v || null))
                }}
              >
                <option value="">—</option>
                {optionsFor(universe, d).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name || 'Sem nome'}
                  </option>
                ))}
                <option value={NEW}>+ Nova opção…</option>
              </select>
            )}
            {option && (
              <button type="button" className="link-btn small whois-open" onClick={() => go('fichas', option.id)}>
                Abrir {option.name || 'a opção'}
              </button>
            )}
            <button
              type="button"
              className="btn-icon btn-sm whois-remove"
              title={`Tirar “${d.name}” de ${kindLabel(e.kind).toLowerCase()}`}
              aria-label={`Tirar ${d.name} deste tipo`}
              onClick={() => update((u) => (d.appliesTo.length > 1 ? updateDefiner(u, d.id, { appliesTo: d.appliesTo.filter((k) => k !== e.kind) }) : removeDefiner(u, d.id)))}
            >
              <X size={13} />
            </button>
          </div>
          {option && traits.length === 0 && (
            <p className="muted small">
              {option.name} ainda não passa nada. Em “Abrir {option.name}”, diga o que quem é assim tem.
            </p>
          )}
          {traits.length > 0 && (
            <ul className="whois-traits" aria-label={`Por ser ${option?.name}`}>
              {traits.map((t) => (
                <li key={t.key} className={t.exception !== null ? 'is-exception' : undefined}>
                  <span className="whois-key">{t.key}</span>
                  {t.exception === null ? (
                    <>
                      <span className="whois-value">{t.value || '—'}</span>
                      {!readOnly && (
                        <button type="button" className="link-btn small" onClick={() => setFields(addException(e, t.key))}>
                          Exceção
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <s className="whois-rule">{t.value || '—'}</s>
                      <input
                        className="input input-sm"
                        aria-label={`Exceção: ${t.key}`}
                        placeholder="Nesta ficha (vazio: não tem)"
                        value={t.exception}
                        onChange={(ev) => setFields(e.fields.map((f) => (fold(f.key.trim()) === fold(t.key.trim()) ? { ...f, value: ev.target.value, exception: true } : f)))}
                      />
                      <button type="button" className="link-btn small" onClick={() => setFields(removeException(e, t.key))}>
                        Desfazer
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="whois-add">
          {others.map((d) => (
            <button key={d.id} type="button" className="chip" onClick={() => update((u) => updateDefiner(u, d.id, { appliesTo: [...d.appliesTo, e.kind] }))}>
              <Plus size={12} aria-hidden="true" /> {d.name}
            </button>
          ))}
          {adding ? (
            <form
              className="inline-fields"
              onSubmit={(ev) => {
                ev.preventDefault()
                create()
              }}
            >
              <input
                className="input"
                autoFocus
                aria-label="O que define"
                placeholder={e.kind === 'personagem' ? 'Espécie, Corpo, Lua de nascimento…' : 'Regime, Ideologia, Origem…'}
                value={name}
                onChange={(ev) => setName(ev.target.value)}
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={!name.trim()}>
                Criar
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdding(false)}>
                Cancelar
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> {rows.length ? 'Outra coisa que define' : 'O que define'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

const optionsFor = (u: ReturnType<typeof useWorkspace>['universe'], d: Definer) => u.entities.filter((x) => x.kind === d.kind).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

/** Numa opção (Meio-ciborgue, Elfo): o que passa para quem é assim. */
export function PassesEditor({ entity: e }: { entity: Entity }) {
  const { universe, update, readOnly } = useWorkspace()
  const defs = definersOf(universe).filter((d) => d.kind === e.kind)
  if (!defs.length) return null
  return (
    <>
      {defs.map((d) => {
        const rows = passesOf(e, d)
        const set = (shared: { key: string; value: string }[]) => update((u) => setPasses(u, e.id, d, shared))
        const n = membersCount(universe, e, d)
        return (
          <section key={d.id} className="whois" aria-label={`O que passa para quem é ${e.name}`}>
            <h2 className="section-title">
              <Sparkles size={15} aria-hidden="true" /> Quem é {e.name || 'assim'} tem
            </h2>
            <p className="muted small">
              Uma opção de “{d.name}”. O que você puser aqui aparece na ficha de quem é {e.name || 'assim'}
              {n ? ` (${n} ${n === 1 ? 'ficha' : 'fichas'} agora)` : ''}. Cada ficha pode ser exceção.
            </p>
            {rows.map((r, i) => (
              <div key={i} className="kv-row">
                <input
                  className="input"
                  aria-label="Característica"
                  placeholder="Característica (ex.: Braço)"
                  value={r.key}
                  disabled={readOnly}
                  onChange={(ev) => set(rows.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)))}
                />
                <input
                  className="input"
                  aria-label={`Valor de ${r.key || 'característica'}`}
                  placeholder="Valor (ex.: mecânico)"
                  value={r.value}
                  disabled={readOnly}
                  onChange={(ev) => set(rows.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))}
                />
                <button type="button" className="btn-icon btn-sm" aria-label="Tirar característica" disabled={readOnly} onClick={() => set(rows.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {!readOnly && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set([...rows, { key: '', value: '' }])}>
                <Plus size={14} /> Característica
              </button>
            )}
          </section>
        )
      })}
    </>
  )
}

/** "Quem é" na leitura: as escolhas, o que vem com elas e as exceções. */
export function WhoIsReader({ entity: e, link }: { entity: Entity; link: (id: string) => React.ReactNode }) {
  const { universe } = useWorkspace()
  const rows = whoIs(universe, e).filter((r) => r.option)
  const defs = definersFor(universe, e.kind)
  if (!rows.length || !defs.length) return null
  return (
    <section className="whois-read" aria-label="Quem é">
      {rows.map(({ definer: d, option, traits }) => (
        <div key={d.id}>
          <p>
            <span className="whois-key">{d.name}:</span> {link(option!.id)}
          </p>
          {traits.length > 0 && (
            <ul className="whois-traits">
              {traits.map((t) => (
                <li key={t.key} className={t.exception !== null ? 'is-exception' : undefined}>
                  <span className="whois-key">{t.key}:</span>{' '}
                  {t.exception === null ? (
                    t.value || '—'
                  ) : (
                    <>
                      <s>{t.value || '—'}</s> {t.exception.trim() || 'não tem'} <span className="muted small">(exceção)</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}
