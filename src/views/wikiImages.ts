import type { Universe } from '../model/schema'
import { imageDataUrl } from '../images/resolve'

/** A capa, os retratos e os mapas prontos para irem dentro do arquivo (a wiki abre sem internet). */
export async function wikiImages(universe: Universe): Promise<Map<string, string>> {
  const images = new Map<string, string>()
  const refs = [universe.settings.cover, ...universe.entities.map((e) => e.image), ...universe.maps.map((m) => m.image)]
  for (const ref of refs) {
    if (!ref || images.has(ref)) continue
    const data = await imageDataUrl(ref).catch(() => null)
    if (data) images.set(ref, data)
  }
  return images
}
