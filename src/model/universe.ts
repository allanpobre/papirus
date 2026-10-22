import type { Scene, SceneDoc, Story, Universe } from './schema'

/** Operações puras sobre o universo. Nunca alteram o objeto recebido. */

export const EMPTY_DOC: SceneDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export function createUniverse(name = 'Meu universo'): Universe {
  const t = now()
  return { id: newId(), name, stories: [], scenes: [], createdAt: t, updatedAt: t }
}

export function scenesOf(universe: Universe, storyId: string | null): Scene[] {
  return universe.scenes.filter((s) => s.storyId === storyId).sort((a, b) => a.order - b.order)
}

export function addStory(universe: Universe, title = 'Nova história'): [Universe, Story] {
  const t = now()
  const story: Story = { id: newId(), title, createdAt: t, updatedAt: t }
  return [{ ...universe, stories: [...universe.stories, story], updatedAt: t }, story]
}

export function renameStory(universe: Universe, storyId: string, title: string): Universe {
  const t = now()
  return {
    ...universe,
    stories: universe.stories.map((s) => (s.id === storyId ? { ...s, title, updatedAt: t } : s)),
    updatedAt: t,
  }
}

/** Remove a história. Suas cenas não são apagadas: viram cenas soltas. */
export function removeStory(universe: Universe, storyId: string): Universe {
  const t = now()
  let order = nextOrder(universe, null)
  return {
    ...universe,
    stories: universe.stories.filter((s) => s.id !== storyId),
    scenes: universe.scenes.map((s) =>
      s.storyId === storyId ? { ...s, storyId: null, order: order++, updatedAt: t } : s,
    ),
    updatedAt: t,
  }
}

export function addScene(
  universe: Universe,
  storyId: string | null,
  title = 'Nova cena',
): [Universe, Scene] {
  const t = now()
  const scene: Scene = {
    id: newId(),
    title,
    storyId,
    order: nextOrder(universe, storyId),
    doc: EMPTY_DOC,
    text: '',
    createdAt: t,
    updatedAt: t,
  }
  return [{ ...universe, scenes: [...universe.scenes, scene], updatedAt: t }, scene]
}

export function updateScene(
  universe: Universe,
  sceneId: string,
  patch: Partial<Pick<Scene, 'title' | 'doc' | 'text'>>,
): Universe {
  const t = now()
  return {
    ...universe,
    scenes: universe.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch, updatedAt: t } : s)),
    updatedAt: t,
  }
}

export function removeScene(universe: Universe, sceneId: string): Universe {
  return { ...universe, scenes: universe.scenes.filter((s) => s.id !== sceneId), updatedAt: now() }
}

function nextOrder(universe: Universe, storyId: string | null): number {
  const orders = universe.scenes.filter((s) => s.storyId === storyId).map((s) => s.order)
  return orders.length ? Math.max(...orders) + 1 : 0
}
