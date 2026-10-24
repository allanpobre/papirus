import { History, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from '../account/auth'
import { KIND_NAME, removeFromTrash, restoreTrash, revertTo, timeAgo, TRASH_DAYS } from '../logic/history'
import { shortName } from '../share/sharing'
import { useWorkspace, type View } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'

const OPENS: Record<string, View> = { scenes: 'escrever', entities: 'fichas', sessions: 'rpg', seeds: 'tramas', events: 'timeline', inbox: 'inbox' }
const ACTION: Record<string, string> = { criou: 'criou', editou: 'editou', apagou: 'apagou', recuperou: 'recuperou', voltou: 'voltou atrás em' }

function useWho() {
  const { user } = useAccount()
  const me = user?.email ? shortName(user.email) : null
  return (by: string | null) => (by === null || by === me ? 'Você' : by)
}

/** O que foi apagado nos últimos 30 dias, para recuperar. */
export function TrashCard() {
  const { universe, update, toast, readOnly } = useWorkspace()
  const who = useWho()
  const { user } = useAccount()
  const me = user?.email ? shortName(user.email) : null
  const items = universe.trash

  return (
    <section className="settings-card" aria-labelledby="lixeira-titulo">
      <h2 id="lixeira-titulo" className="section-title">
        <Trash2 size={16} aria-hidden="true" /> Lixeira
      </h2>
      <p className="small muted">O que for apagado fica aqui por {TRASH_DAYS} dias, inclusive o que outra pessoa apagou num universo compartilhado. Depois some sozinho.</p>
      {items.length ? (
        <>
          <ul className="history-list">
            {items.map((t) => (
              <li key={t.id}>
                <span className="history-text">
                  <strong>{t.label}</strong>
                  <span className="muted tiny">
                    {KIND_NAME[t.kind]?.replace(/^(a|o) /, '') ?? 'item'} · {who(t.by)} apagou {timeAgo(t.deletedAt)}
                  </span>
                </span>
                {!readOnly && (
                  <span className="history-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        update((u) => restoreTrash(u, t.id, me))
                        toast(`“${t.label}” voltou.`)
                      }}
                    >
                      <RotateCcw size={14} /> Recuperar
                    </button>
                    <ConfirmButton className="btn-icon btn-sm" title={`Apagar de vez ${t.label}`} question="Apagar de vez? Não dá para recuperar depois." confirmLabel="Apagar de vez" onConfirm={() => update((u) => removeFromTrash(u, t.id))}>
                      <Trash2 size={14} aria-label={`Apagar de vez ${t.label}`} />
                    </ConfirmButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <ConfirmButton className="btn btn-ghost btn-sm" title="Esvaziar a lixeira" question={`Apagar de vez os ${items.length} itens da lixeira?`} confirmLabel="Esvaziar" onConfirm={() => update((u) => removeFromTrash(u, 'tudo'))}>
              Esvaziar a lixeira
            </ConfirmButton>
          )}
        </>
      ) : (
        <p className="small">A lixeira está vazia.</p>
      )}
    </section>
  )
}

/** Quem mudou o quê, com a opção de voltar como estava. */
export function HistoryCard() {
  const { universe, update, toast, go, readOnly } = useWorkspace()
  const who = useWho()
  const { user } = useAccount()
  const me = user?.email ? shortName(user.email) : null
  const [limit, setLimit] = useState(30)
  const entries = universe.history.slice(0, limit)
  const alive = (kind: string, id: string) => (universe[kind as 'scenes'] as { id: string }[] | undefined)?.some((x) => x.id === id) ?? false

  return (
    <section className="settings-card" aria-labelledby="historico-titulo">
      <h2 id="historico-titulo" className="section-title">
        <History size={16} aria-hidden="true" /> Histórico de mudanças
      </h2>
      <p className="small muted">Edições seguidas no mesmo item viram uma linha só. As mais recentes guardam como o item estava antes, para voltar atrás.</p>
      {entries.length ? (
        <ul className="history-list">
          {entries.map((h) => {
            const view = OPENS[h.kind]
            const exists = alive(h.kind, h.recordId)
            return (
              <li key={h.id}>
                <span className="history-text">
                  <span>
                    {who(h.by)} {ACTION[h.action]} {KIND_NAME[h.kind] ?? 'o item'}{' '}
                    {view && exists ? (
                      <button type="button" className="link-btn" onClick={() => go(view, h.recordId)}>
                        {h.label}
                      </button>
                    ) : (
                      <strong>{h.label}</strong>
                    )}
                  </span>
                  <span className="muted tiny">{timeAgo(h.at)}</span>
                </span>
                {!readOnly && h.before && h.action !== 'apagou' && (
                  <span className="history-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Volta o item para como estava antes desta mudança"
                      onClick={() => {
                        update((u) => revertTo(u, h.id, me))
                        toast(`“${h.label}” voltou a como estava.`)
                      }}
                    >
                      <Undo2 size={14} /> Voltar a como estava
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="small">Nada ainda. As mudanças aparecem aqui conforme você (e quem mais edita) mexe no universo.</p>
      )}
      {universe.history.length > limit && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit(limit + 50)}>
          Mostrar mais
        </button>
      )}
    </section>
  )
}
