import { History, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { compareSceneVersions, splitDiff, type CompareTarget, type DiffPart } from '../../logic/diff'
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
  // Compara a versão escolhida com o texto atual (padrão) ou com outra versão; juntos ou lado a lado (no celular, um embaixo do outro).
  const [against, setAgainst] = useState<CompareTarget>('atual')
  const [layout, setLayout] = useState<'juntos' | 'lado'>('juntos')
  const target: CompareTarget = against !== 'atual' && against !== selected && scene.versions.some((v) => v.id === against) ? against : 'atual'
  const comparison = useMemo(() => (version ? compareSceneVersions(scene, version.id, target) : null), [version, scene, target])
  const parts = comparison?.parts ?? []
  const stats = comparison?.stats ?? { inserted: 0, removed: 0 }
  const sides = useMemo(() => splitDiff(comparison?.parts ?? []), [comparison])

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
                  De “{comparison?.fromName}” para {target === 'atual' ? 'o texto atual' : `“${comparison?.toName}”`}: <span className="diff-ins-label">+{stats.inserted}</span>{' '}
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
              <div className="version-compare">
                <label className="version-against">
                  <span className="small">Comparar com</span>
                  <select className="input input-sm" value={target} onChange={(e) => setAgainst(e.target.value)}>
                    <option value="atual">O texto atual</option>
                    {scene.versions
                      .filter((v) => v.id !== version.id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({dateFmt.format(new Date(v.at))})
                        </option>
                      ))}
                  </select>
                </label>
                <div className="segmented" role="radiogroup" aria-label="Como mostrar">
                  {(
                    [
                      ['juntos', 'Juntos'],
                      ['lado', 'Lado a lado'],
                    ] as const
                  ).map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={layout === value} onClick={() => setLayout(value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {layout === 'juntos' ? (
                <div className="diff">{renderDiff(parts)}</div>
              ) : (
                <div className="diff-pair">
                  <section aria-label={`Antes: ${comparison?.fromName}`}>
                    <h3 className="diff-side-title">Antes: {comparison?.fromName}</h3>
                    <div className="diff">{renderDiff(sides.before)}</div>
                  </section>
                  <section aria-label={`Depois: ${comparison?.toName}`}>
                    <h3 className="diff-side-title">Depois: {comparison?.toName}</h3>
                    <div className="diff">{renderDiff(sides.after)}</div>
                  </section>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

/** O diff como texto: o que ficou igual, o que entrou (verde) e o que saiu (riscado). */
function renderDiff(parts: DiffPart[]) {
  if (parts.length === 0) return <span className="muted">Texto vazio.</span>
  return parts.map((p, i) => (p.kind === 'igual' ? <span key={i}>{p.text}</span> : p.kind === 'inserido' ? <ins key={i}>{p.text}</ins> : <del key={i}>{p.text}</del>))
}
