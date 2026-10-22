import { useState } from 'react'
import { SceneEditor } from './editor/SceneEditor'
import { downloadText, fileNameFor } from './export/download'
import { sceneToMarkdown, universeToMarkdown } from './export/markdown'
import {
  addScene,
  addStory,
  removeScene,
  removeStory,
  renameStory,
  scenesOf,
  updateScene,
} from './model/universe'
import type { Scene } from './model/schema'
import { useUniverse, type SaveStatus } from './persistence/useUniverse'

const STATUS_LABEL: Record<SaveStatus, string> = {
  carregando: 'Carregando…',
  salvo: 'Salvo',
  pendente: 'Alterações não salvas',
  salvando: 'Salvando…',
  erro: 'Erro ao salvar',
}

export default function App() {
  const { universe, status, loadError, storeKind, update, toFile } = useUniverse()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (loadError) {
    return (
      <main className="load-error" role="alert">
        <h1>Não foi possível abrir seus dados</h1>
        <p>{loadError}</p>
        <p>Nada foi apagado nem sobrescrito.</p>
      </main>
    )
  }
  if (!universe) return <main className="loading">Carregando…</main>

  const selected = universe.scenes.find((s) => s.id === selectedId) ?? null

  const newScene = (storyId: string | null) => {
    let created: Scene | undefined
    update((u) => {
      const [next, scene] = addScene(u, storyId)
      created = scene
      return next
    })
    if (created) setSelectedId(created.id)
  }

  const deleteScene = (scene: Scene) => {
    if (!window.confirm(`Apagar a cena “${scene.title || 'Sem título'}”?`)) return
    update((u) => removeScene(u, scene.id))
    if (selectedId === scene.id) setSelectedId(null)
  }

  const sceneList = (scenes: Scene[]) => (
    <ul className="scene-list">
      {scenes.map((scene) => (
        <li key={scene.id}>
          <button
            type="button"
            className="scene-link"
            aria-current={scene.id === selectedId ? 'true' : undefined}
            onClick={() => setSelectedId(scene.id)}
          >
            {scene.title || 'Sem título'}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Manuscrito">
        <header className="sidebar-header">
          <span className="brand">Papirus</span>
          <span className="save-status" role="status" data-status={status}>
            {STATUS_LABEL[status]}
            {storeKind === 'memory' && ' (sem armazenamento local: exporte antes de sair)'}
          </span>
        </header>

        {universe.stories.map((story) => (
          <section key={story.id} className="story" aria-label={story.title || 'Sem título'}>
            <div className="story-header">
              <input
                className="story-title"
                aria-label="Título da história"
                value={story.title}
                placeholder="Sem título"
                onChange={(e) => update((u) => renameStory(u, story.id, e.target.value))}
              />
              <button
                type="button"
                title="Remover a história (as cenas viram cenas soltas)"
                onClick={() => {
                  if (window.confirm('Remover esta história? As cenas dela não serão apagadas.'))
                    update((u) => removeStory(u, story.id))
                }}
              >
                Remover
              </button>
            </div>
            {sceneList(scenesOf(universe, story.id))}
            <button type="button" onClick={() => newScene(story.id)}>
              + Cena
            </button>
          </section>
        ))}

        <section className="story" aria-label="Cenas soltas">
          <h2 className="story-heading">Cenas soltas</h2>
          {sceneList(scenesOf(universe, null))}
          <button type="button" onClick={() => newScene(null)}>
            + Cena solta
          </button>
        </section>

        <div className="sidebar-actions">
          <button type="button" onClick={() => update((u) => addStory(u)[0])}>
            + História
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(fileNameFor(universe.name, 'md'), universeToMarkdown(universe))
            }
          >
            Exportar tudo (Markdown)
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                fileNameFor(`${universe.name}-backup`, 'json'),
                JSON.stringify(toFile(universe), null, 2),
                'application/json',
              )
            }
          >
            Backup (JSON)
          </button>
        </div>
      </aside>

      <main className="writing">
        {selected ? (
          <article className="scene">
            <div className="scene-header">
              <input
                className="scene-title"
                aria-label="Título da cena"
                value={selected.title}
                placeholder="Sem título"
                onChange={(e) => update((u) => updateScene(u, selected.id, { title: e.target.value }))}
              />
              <button
                type="button"
                onClick={() =>
                  downloadText(fileNameFor(selected.title, 'md'), sceneToMarkdown(selected))
                }
              >
                Exportar cena
              </button>
              <button type="button" onClick={() => deleteScene(selected)}>
                Apagar
              </button>
            </div>
            <SceneEditor
              key={selected.id}
              doc={selected.doc}
              onChange={(doc, text) => update((u) => updateScene(u, selected.id, { doc, text }))}
            />
          </article>
        ) : (
          <div className="empty">
            <p>Escolha uma cena ou comece uma nova.</p>
            <button type="button" onClick={() => newScene(null)}>
              Começar a escrever
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
