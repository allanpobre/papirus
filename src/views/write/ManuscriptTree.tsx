import { ChevronDown, ChevronUp, FilePlus2, FolderPlus, Trash2 } from 'lucide-react'
import { SCENE_STATUS_LABEL } from '../../model/labels'
import type { Scene } from '../../model/schema'
import { addScene, addStory, moveScene, removeStory, renameStory, scenesOf } from '../../model/universe'
import { wordCount } from '../../persistence/repository'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'

/** Árvore do manuscrito: histórias com suas cenas, e as cenas soltas. */
export function ManuscriptTree({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { universe, update, undoable } = useWorkspace()

  const newScene = (storyId: string | null) => {
    let created: Scene | undefined
    update((u) => {
      const [next, s] = addScene(u, storyId)
      created = s
      return next
    })
    if (created) onSelect(created.id)
  }

  const list = (scenes: Scene[]) => (
    <ol className="tree-scenes">
      {scenes.map((s, i) => (
        <li key={s.id} className="tree-scene">
          <button
            type="button"
            className="tree-scene-link"
            aria-current={s.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(s.id)}
          >
            <span className={`status-dot status-${s.status}`} title={SCENE_STATUS_LABEL[s.status]} aria-hidden="true" />
            <span className="tree-scene-title">{s.title || 'Sem título'}</span>
            <span className="tree-scene-words">{wordCount(s.text) || ''}</span>
          </button>
          <span className="tree-scene-move">
            <button
              type="button"
              className="btn-icon btn-xs"
              aria-label={`Subir ${s.title}`}
              disabled={i === 0}
              onClick={() => update((u) => moveScene(u, s.id, -1))}
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              className="btn-icon btn-xs"
              aria-label={`Descer ${s.title}`}
              disabled={i === scenes.length - 1}
              onClick={() => update((u) => moveScene(u, s.id, 1))}
            >
              <ChevronDown size={13} />
            </button>
          </span>
        </li>
      ))}
    </ol>
  )

  return (
    <div className="tree">
      {universe.stories.map((story) => {
        const scenes = scenesOf(universe, story.id)
        return (
          <section key={story.id} className="tree-story" aria-label={story.title || 'Sem título'}>
            <div className="tree-story-head">
              <input
                className="tree-story-title"
                aria-label="Título da história"
                value={story.title}
                placeholder="Sem título"
                onChange={(e) => update((u) => renameStory(u, story.id, e.target.value))}
              />
              <ConfirmButton
                className="btn-icon btn-xs"
                title="Remover a história (as cenas viram cenas soltas)"
                question="Remover? As cenas viram soltas."
                confirmLabel="Remover história"
                onConfirm={() => undoable('História removida; as cenas viraram cenas soltas', (u) => removeStory(u, story.id))}
              >
                <Trash2 size={13} aria-label="Remover história" />
              </ConfirmButton>
            </div>
            {list(scenes)}
            <button type="button" className="tree-add" onClick={() => newScene(story.id)}>
              <FilePlus2 size={14} /> Nova cena
            </button>
          </section>
        )
      })}

      <section className="tree-story" aria-label="Cenas soltas">
        <div className="tree-story-head">
          <h3 className="tree-loose">Cenas soltas</h3>
        </div>
        {list(scenesOf(universe, null))}
        <button type="button" className="tree-add" onClick={() => newScene(null)}>
          <FilePlus2 size={14} /> Nova cena solta
        </button>
      </section>

      <button type="button" className="btn btn-ghost btn-sm tree-new-story" onClick={() => update((u) => addStory(u)[0])}>
        <FolderPlus size={15} /> Nova história
      </button>
    </div>
  )
}
