import { FolderOutput } from 'lucide-react'
import { downloadBytes } from '../export/exportBook'
import { fileNameFor } from '../export/download'
import { obsidianVault } from '../export/obsidian'
import { useWorkspace } from '../state/workspace'

/** “Levar de volta para o Obsidian” (auditoria 26, Duda): o mundo como um cofre de notas, em .zip. */
export function ObsidianExport() {
  const { universe, toast } = useWorkspace()
  if (universe.entities.length === 0) return null
  return (
    <section className="settings-card" aria-labelledby="obsidian-titulo">
      <h2 id="obsidian-titulo" className="section-title">
        <FolderOutput size={16} aria-hidden="true" /> Levar para o Obsidian
      </h2>
      <p className="muted small">
        Baixa um .zip com uma pasta por tipo (Personagens, Lugares…) e uma nota por ficha. Os nomes das outras fichas viram [[ligações]] e as ligações
        ficam no fim de cada nota. Abra como um cofre novo ou junte ao seu. É uma cópia: o que mudar lá volta por “Trazer de outro app”.
      </p>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          downloadBytes(fileNameFor(`${universe.name || 'Papirus'} (Obsidian)`, 'zip'), obsidianVault(universe), 'application/zip')
          toast(`${universe.entities.length} notas no .zip`)
        }}
      >
        Baixar o cofre (.zip)
      </button>
    </section>
  )
}
