import type { Universe } from '../model/schema'
import { newId } from '../model/universe'
import type { Library, LibraryEntry } from './repository'

/** O que versões antigas punham no nome da cópia (às vezes mais de uma vez). */
const OLD_SUFFIX = /\s*\(versão da nuvem\)/g

/** O nome sem o "(versão da nuvem)" antigo. */
export const cleanName = (name: string) => name.replace(OLD_SUFFIX, '').trim()

/** A cópia antiga, de antes da marca: reconhecida só pelo nome. */
export const hasOldCopyName = (name: string) => / \(versão da nuvem\)/.test(name)

/** É a versão da nuvem guardada ao lado de outro universo (as novas são marcadas; as antigas, pelo nome). */
export const isCloudCopy = (e: { name: string; cloudCopyOf?: string | null }) => Boolean(e.cloudCopyOf) || / \(versão da nuvem\)/.test(e.name)

/** O mesmo conteúdo dos dois lados (fora datas, histórico e contagem do dia): não precisa de cópia. */
export function sameUniverse(a: Universe, b: Universe): boolean {
  const strip = ({ updatedAt: _u, history: _h, dailyStart: _d, cloudCopyOf: _c, versionKind: _k, ...rest }: Universe) => rest
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

/**
 * Guarda a versão da nuvem ao lado, com o mesmo nome e a marca de cópia. Se já há uma cópia
 * deste universo aqui, ela é trocada pela nova (em vez de empilhar cópias).
 */
export async function keepCloudCopy(lib: Library, originalId: string, theirs: Universe): Promise<Universe> {
  // Só troca a versão que veio da nuvem: um backup importado ou a versão de antes de uma troca ficam como estão.
  const existing = (await lib.list()).find((e) => e.cloudCopyOf === originalId && (e.versionKind ?? 'nuvem') === 'nuvem')
  const copy: Universe = { ...theirs, id: existing?.id ?? newId(), name: cleanName(theirs.name), cloudCopyOf: originalId, versionKind: 'nuvem' }
  await lib.repository(copy.id).save(copy)
  await lib.touch(copy)
  return copy
}

/** Um universo e as versões guardadas dele (cópias de quando os dois lados mudaram), da mais nova para a mais antiga. */
export interface Family {
  main: LibraryEntry
  versions: LibraryEntry[]
}

/**
 * A lista em duplas: um item por universo, com as versões guardadas dentro dele em vez de soltas.
 * Uma versão cujo original não está aqui aparece como um universo (é a única que sobrou).
 * A ordem é a recebida (a dos universos).
 */
export function families(entries: LibraryEntry[]): Family[] {
  const byId = new Map(entries.map((e) => [e.id, e]))
  /** O universo no fim da corrente (uma versão de uma versão é versão do mesmo universo). */
  const root = (e: LibraryEntry): LibraryEntry => {
    let at = e
    const seen = new Set<string>()
    while (at.cloudCopyOf && byId.has(at.cloudCopyOf) && !seen.has(at.id)) {
      seen.add(at.id)
      at = byId.get(at.cloudCopyOf)!
    }
    return at
  }
  const versions = new Map<string, LibraryEntry[]>()
  for (const e of entries) {
    const r = root(e)
    if (r !== e) versions.set(r.id, [...(versions.get(r.id) ?? []), e])
  }
  return entries
    .filter((e) => root(e) === e)
    .map((main) => ({ main, versions: (versions.get(main.id) ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }))
}

/** Quanto de `a` também está em `b`: a parte das cenas e fichas de `a` (pelo id) que `b` tem. De 0 a 1. */
export function sharedShare(a: Universe, b: Universe): number {
  const mine = [...a.scenes, ...a.entities].map((r) => r.id)
  if (!mine.length) return 0
  const theirs = new Set([...b.scenes, ...b.entities].map((r) => r.id))
  return mine.filter((id) => theirs.has(id)).length / mine.length
}

/**
 * De qual universo esta cópia antiga é versão: o de mesmo nome (sem o "(versão da nuvem)"); se há
 * mais de um, ou nenhum (o original mudou de nome), o que tem as mesmas cenas e fichas.
 * `null` = não há original aqui: a cópia continua sendo um universo.
 */
export async function originalOf(lib: Library, copy: LibraryEntry, entries: LibraryEntry[]): Promise<LibraryEntry | null> {
  const fold = (name: string) => cleanName(name).toLocaleLowerCase('pt-BR')
  const others = entries.filter((e) => e.id !== copy.id && !e.sample && !isCloudCopy(e))
  const sameName = others.filter((e) => fold(e.name) === fold(copy.name))
  if (sameName.length === 1) return sameName[0]
  const mine = await lib.repository(copy.id).load()
  if (!mine) return null
  let best: LibraryEntry | null = null
  let bestShare = 0
  for (const e of sameName.length ? sameName : others) {
    const u = await lib.repository(e.id).load()
    const share = u ? sharedShare(mine, u) : 0
    if (share > bestShare) {
      best = e
      bestShare = share
    }
  }
  // Metade das cenas e fichas em comum: é o mesmo livro. Menos que isso, não dá para afirmar.
  return bestShare >= 0.5 ? best : null
}
