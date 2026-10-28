import { History, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { diffStats, diffWords } from '../../logic/diff'
import type { Scene } from '../../model/schema'
import { patch, restoreSceneVersion, saveSceneVersion } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { Modal } from '../../ui/Modal'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Versões guardadas de uma cena: guardar, comparar com o texto atual e voltar. */
export function VersionsDialog({ scene, onClose, onRestored }: { scene: Scene; onClose: () => void; onRestored: () => void }) {
  const { update, toast } = useWorkspace()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string | null>(scene.versions[0]?.id ?? null)
  const version = scene.versions.find((v) => v.id === selected)
  const parts = useMemo(() => (version ? diffWords(version.text, scene.text) : []), [version, scene.text])
  const stats = diffStats(parts)

  return (
    <Modal title={`Versões de “${scene.title || 'Sem título'}”`} onClose={onClose} size="lg" help="versoes">
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          update((u) => saveSceneVersion(u, scene.id, name.trim() || `Versão de ${dateFmt.format(new Date())}`))
          setName('')
          toast('Versão guardada')
        }}
      >
        <label htmlFor="version-name" className="sr-only">
          Nome da versão
        </label>
        <input id="version-name" className="input" placeholder="Ex.: antes de mudar o final" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          <History size={16} /> Guardar texto atual
        </button>
      </form>

      {scene.versions.length === 0 ? (
        <p className="empty-inline">Nenhuma versão guardada. Guarde uma antes de mexer muito na cena.</p>
      ) : (
        <div className="versions">
          <ul className="version-list" aria-label="Versões">
            {scene.versions.map((v) => (
              <li key={v.id}>
                <button type="button" className="version-row" aria-current={v.id === selected ? 'true' : undefined} onClick={() => setSelected(v.id)}>
                  <span className="version-name">{v.name}</span>
                  <span className="muted tiny">{dateFmt.format(new Date(v.at))}</span>
                </button>
              </li>
            ))}
          </ul>
          {version && (
            <section className="version-detail" aria-label="Comparação">
              <div className="version-head">
                <span className="small">
                  Do texto guardado para o atual: <span className="diff-ins-label">+{stats.inserted}</span>{' '}
                  <span className="diff-del-label">−{stats.removed}</span> palavras
                </span>
                <div className="inline-fields">
                  <ConfirmButton
                    className="btn btn-sm btn-primary"
                    question="Voltar para esta versão? O texto atual vira uma versão."
                    confirmLabel="Voltar"
                    onConfirm={() => {
                      update((u) => restoreSceneVersion(u, scene.id, version.id))
                      onRestored()
                      toast(`A cena voltou para “${version.name}”`)
                      onClose()
                    }}
                  >
                    Voltar para esta versão
                  </ConfirmButton>
                  <ConfirmButton
                    className="btn-icon btn-sm"
                    title="Apagar versão"
                    question="Apagar?"
                    confirmLabel="Apagar"
                    onConfirm={() => {
                      update((u) => patch(u, 'scenes', scene.id, { versions: scene.versions.filter((x) => x.id !== version.id) }))
                      setSelected(null)
                    }}
                  >
                    <Trash2 size={14} aria-label="Apagar versão" />
                  </ConfirmButton>
                </div>
              </div>
              <div className="diff">
                {parts.length === 0 ? (
                  <span className="muted">Texto vazio.</span>
                ) : (
                  parts.map((p, i) =>
                    p.kind === 'igual' ? (
                      <span key={i}>{p.text}</span>
                    ) : p.kind === 'inserido' ? (
                      <ins key={i}>{p.text}</ins>
                    ) : (
                      <del key={i}>{p.text}</del>
                    ),
                  )
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
