import { Download, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Library, LibraryEntry } from '../persistence/repository'
import { baseName, confirmRepeats, tidyGroup, VERSION_LIMIT, type RepeatGroup } from '../persistence/versions'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Modal } from '../ui/Modal'

interface Props {
  library: Library
  /** Os candidatos que a lista achou sem abrir os universos. */
  candidates: LibraryEntry[][]
  /** Tem registro na nuvem (subiu algum dia)? */
  inCloud: (id: string) => boolean
  /** Tira estes da nuvem (os que deixaram de ser universo). */
  leaveCloud: (ids: string[]) => Promise<void>
  /** "São universos diferentes": não perguntar de novo por este grupo. */
  onDifferent: (ids: string[]) => void
  onDownload: (e: LibraryEntry) => Promise<void> | void
  onChanged: () => void
  onClose: () => void
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** O que cada um era antes de arrumar: o universo, uma cópia da nuvem, um backup importado. */
function was(e: LibraryEntry): string {
  if (e.cloudCopyOf) return e.versionKind === 'backup' ? 'backup importado' : e.versionKind === 'anterior' ? 'versão anterior' : 'era “versão da nuvem”'
  if (/\((importado|da pasta)\)/.test(e.name)) return 'era “(importado)”'
  if (/\(versão da nuvem\)/.test(e.name)) return 'era “versão da nuvem”'
  return 'universo'
}

/**
 * Arrumar os repetidos: para cada livro que aparece mais de uma vez, a pessoa escolhe qual é o
 * universo. Os outros viram versões guardadas dele (ou são apagados) e saem da nuvem: fica um por livro.
 */
export function TidyDialog({ library, candidates, inCloud, leaveCloud, onDifferent, onDownload, onChanged, onClose }: Props) {
  const [groups, setGroups] = useState<RepeatGroup[] | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Confere uma vez, ao abrir: depois de arrumar um grupo, ele só sai da lista.
  useEffect(() => {
    let off = false
    void confirmRepeats(library, candidates)
      .then((g) => {
        if (off) return
        setGroups(g)
        // Nome igual com histórias diferentes: não é repetido; o aviso não volta por eles.
        for (const c of candidates) {
          const mains = c.filter((e) => !e.cloudCopyOf)
          if (mains.length > 1 && !g.some((x) => x.entries.some((e) => mains.some((m) => m.id === e.id)))) onDifferent(mains.map((e) => e.id))
        }
      })
      .catch((err) => !off && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library])

  const key = (g: RepeatGroup) => g.entries.map((e) => e.id).sort().join('|')
  const apply = async (g: RepeatGroup, keep: boolean) => {
    setBusy(key(g))
    setError(null)
    try {
      const r = await tidyGroup(library, g, choice[key(g)] ?? g.suggested, keep, inCloud)
      await leaveCloud([...new Set([...r.leaveCloud, ...r.removed.map((e) => e.id)])].filter(inCloud))
      setGroups((list) => (list ?? []).filter((x) => x !== g))
      setDone((n) => n + 1)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title="Arrumar repetidos" onClose={onClose} size="lg">
      <p className="muted small tidy-lede">Para cada livro que aparece mais de uma vez, escolha qual é o universo. Os outros viram versões guardadas dentro dele, só neste aparelho, e saem da nuvem: fica um por livro.</p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {groups === null ? (
        <p className="muted" role="status">
          <Loader2 size={15} className="spin" aria-hidden="true" /> Conferindo as cenas e fichas de cada um…
        </p>
      ) : groups.length === 0 ? (
        <p role="status" className="tidy-done">
          {done > 0 ? 'Tudo arrumado: um universo por livro.' : 'Nada para arrumar: os universos de nome igual têm histórias diferentes.'}
        </p>
      ) : (
        groups.map((g) => {
          const id = key(g)
          const picked = choice[id] ?? g.suggested
          const name = baseName(g.entries[0].name) || 'Sem nome'
          const over = Math.max(0, g.entries.length - 1 - VERSION_LIMIT)
          const mains = g.entries.filter((e) => !e.cloudCopyOf)
          return (
            <section key={id} className="tidy-group" aria-label={name}>
              <h3 className="tidy-title">
                {name}: {g.entries.length} versões encontradas
              </h3>
              <div className="tidy-list" role="radiogroup" aria-label={`Qual é o universo de ${name}`}>
                {g.entries.map((e) => (
                  <label key={e.id} className={`tidy-row${picked === e.id ? ' is-main' : ''}`}>
                    <input type="radio" name={`principal-${id}`} checked={picked === e.id} onChange={() => setChoice((c) => ({ ...c, [id]: e.id }))} />
                    <span className="tidy-row-what">
                      <strong>{dateFmt.format(new Date(e.updatedAt))}</strong> · {e.kind === 'campanha' ? `${e.sessions ?? 0} ${e.sessions === 1 ? 'sessão' : 'sessões'}` : `${e.words.toLocaleString('pt-BR')} palavras`}
                    </span>
                    <span className="tidy-row-where muted small">
                      {inCloud(e.id) ? 'neste aparelho e na nuvem' : 'só neste aparelho'} · {was(e)}
                      {e.id === g.suggested && ' · a mais recente'}
                    </span>
                  </label>
                ))}
              </div>
              {over > 0 && (
                <p className="small tidy-warn">
                  Guardando, ficam as {VERSION_LIMIT} versões mais recentes; {over === 1 ? 'a mais antiga será apagada' : `as ${over} mais antigas serão apagadas`}.
                </p>
              )}
              <div className="tidy-actions">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void apply(g, true)}>
                  {busy === id ? <Loader2 size={15} className="spin" aria-hidden="true" /> : null} Guardar as outras como versões
                </button>
                <ConfirmButton className="btn btn-sm" question={`Apagar ${g.entries.length - 1 === 1 ? 'a outra' : `as outras ${g.entries.length - 1}`} de vez, aqui e na nuvem?`} confirmLabel="Apagar as outras" onConfirm={() => apply(g, false)}>
                  Apagar as outras
                </ConfirmButton>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    for (const e of g.entries) await onDownload(e)
                  }}
                >
                  <Download size={15} aria-hidden="true" /> Baixar backup de todas
                </button>
                {mains.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      onDifferent(mains.map((e) => e.id))
                      setGroups((list) => (list ?? []).filter((x) => x !== g))
                    }}
                  >
                    São universos diferentes
                  </button>
                )}
              </div>
            </section>
          )
        })
      )}
    </Modal>
  )
}
