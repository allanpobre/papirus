import type { Universe } from '../model/schema'
import { idToRef } from './ref'
import { imageId, saveImage } from './store'

/** Mapas antigos traziam a imagem dentro do universo (data URL); acima disto, vale mover para fora. */
const BIG = 30_000

/**
 * Tira de dentro do universo as imagens de mapas antigos (que pesam a cada gravação e
 * sincronização) e passa a guardá-las como as outras imagens. A imagem é guardada antes de
 * trocar a referência: se algo falhar no meio, o mapa continua como estava.
 */
export async function moveInlineMaps(universe: Universe): Promise<Map<string, string>> {
  const moved = new Map<string, string>()
  for (const m of universe.maps) {
    if (!m.image.startsWith('data:image/') || m.image.length < BIG) continue
    try {
      const blob = await (await fetch(m.image)).blob()
      const id = await imageId(blob)
      await saveImage({ id, blob, width: m.width, height: m.height })
      moved.set(m.image, idToRef(id))
    } catch {
      // Fica embutido, como antes.
    }
  }
  return moved
}

/** Troca as imagens movidas pelas referências (só onde ainda é a mesma imagem). */
export function applyMoved(u: Universe, moved: Map<string, string>): Universe {
  if (!moved.size || !u.maps.some((m) => moved.has(m.image))) return u
  return { ...u, maps: u.maps.map((m) => (moved.has(m.image) ? { ...m, image: moved.get(m.image)! } : m)) }
}
