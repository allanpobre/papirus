import type { Universe } from '../model/schema'
import { newId } from '../model/universe'
import type { Library } from './repository'

/** O que versões antigas punham no nome da cópia (às vezes mais de uma vez). */
const OLD_SUFFIX = /\s*\(versão da nuvem\)/g

/** O nome sem o "(versão da nuvem)" antigo. */
export const cleanName = (name: string) => name.replace(OLD_SUFFIX, '').trim()

/** É a versão da nuvem guardada ao lado de outro universo (as novas são marcadas; as antigas, pelo nome). */
export const isCloudCopy = (e: { name: string; cloudCopyOf?: string | null }) => Boolean(e.cloudCopyOf) || / \(versão da nuvem\)/.test(e.name)

/** O mesmo conteúdo dos dois lados (fora datas, histórico e contagem do dia): não precisa de cópia. */
export function sameUniverse(a: Universe, b: Universe): boolean {
  const strip = ({ updatedAt: _u, history: _h, dailyStart: _d, cloudCopyOf: _c, ...rest }: Universe) => rest
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

/**
 * Guarda a versão da nuvem ao lado, com o mesmo nome e a marca de cópia. Se já há uma cópia
 * deste universo aqui, ela é trocada pela nova (em vez de empilhar cópias).
 */
export async function keepCloudCopy(lib: Library, originalId: string, theirs: Universe): Promise<Universe> {
  const existing = (await lib.list()).find((e) => e.cloudCopyOf === originalId)
  const copy: Universe = { ...theirs, id: existing?.id ?? newId(), name: cleanName(theirs.name), cloudCopyOf: originalId }
  await lib.repository(copy.id).save(copy)
  await lib.touch(copy)
  return copy
}
