import type { Universe } from '../model/schema'
import { newId } from '../model/universe'
import { cleanName, sharedShare } from './cloudCopy'
import type { Library, LibraryEntry } from './repository'

/** Quantas versões guardadas um universo mantém: passou disso, a mais antiga sai. */
export const VERSION_LIMIT = 5

export type VersionKind = NonNullable<Universe['versionKind']>

/** Como chamar a versão na lista. */
export const versionLabel = (kind: VersionKind | null | undefined) => (kind === 'backup' ? 'backup importado' : kind === 'anterior' ? 'versão anterior' : 'versão da nuvem')

/** O que versões antigas e a importação punham no nome. */
const EXTRA = /\s*\((versão da nuvem|importado|da pasta)\)/g
/** O nome do livro, sem "(importado)", "(da pasta)" nem "(versão da nuvem)". */
export const baseName = (name: string) => name.replace(EXTRA, '').trim()

async function put(lib: Library, u: Universe) {
  await lib.repository(u.id).save(u)
  await lib.touch(u)
}

/** Guarda `u` como versão do universo `mainId` (com id próprio; nunca vai para a nuvem). */
export async function addVersion(lib: Library, mainId: string, u: Universe, kind: VersionKind): Promise<Universe> {
  const version: Universe = { ...u, id: newId(), name: baseName(u.name), cloudCopyOf: mainId, versionKind: kind }
  await put(lib, version)
  return version
}

/** Marca um universo que já está aqui como versão guardada de outro. */
export async function demoteToVersion(lib: Library, id: string, mainId: string, kind: VersionKind): Promise<void> {
  const u = await lib.repository(id).load()
  if (!u) return
  await put(lib, { ...u, name: baseName(u.name), cloudCopyOf: mainId, versionKind: u.versionKind ?? kind })
}

/**
 * "Ficar com esta versão": a versão passa a ser o universo e o que era o universo fica guardado
 * como versão. Os dois trocam de conteúdo e mantêm os ids: o universo continua com a mesma
 * dupla na nuvem, os mesmos convites e o mesmo link de leitura.
 */
export async function keepVersion(lib: Library, mainId: string, versionId: string, now = new Date().toISOString()): Promise<void> {
  const main = await lib.repository(mainId).load()
  const version = await lib.repository(versionId).load()
  if (!main || !version) throw new Error('Não achei o universo ou a versão neste aparelho.')
  // A data nova faz a sincronização enviar o que ficou: mudou aqui desde a última vez.
  await put(lib, { ...version, id: mainId, name: baseName(version.name), cloudCopyOf: null, versionKind: null, updatedAt: now })
  await put(lib, { ...main, id: versionId, cloudCopyOf: mainId, versionKind: 'anterior' })
}

/** Troca o universo pelo que veio de fora (um backup): o que estava vira versão guardada. */
export async function replaceWith(lib: Library, mainId: string, incoming: Universe, now = new Date().toISOString()): Promise<void> {
  const main = await lib.repository(mainId).load()
  if (main) await addVersion(lib, mainId, main, 'anterior')
  await put(lib, { ...incoming, id: mainId, name: baseName(incoming.name), cloudCopyOf: null, versionKind: null, updatedAt: now })
}

/** Mantém as versões mais recentes de um universo; devolve as que saíram (para apagar da conta, se subiram, e avisar). */
export async function trimVersions(lib: Library, mainId: string, limit = VERSION_LIMIT): Promise<LibraryEntry[]> {
  const versions = (await lib.list()).filter((e) => e.cloudCopyOf === mainId)
  const out = versions.slice(limit)
  for (const e of out) await lib.remove(e.id)
  return out
}

/** Universos que parecem o mesmo livro. */
export interface RepeatGroup {
  /** Todos os do grupo, do mais recente para o mais antigo. */
  entries: LibraryEntry[]
  /** O sugerido como principal: o mexido por último. */
  suggested: string
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

/**
 * O que a lista já mostra sem abrir nenhum universo: há algo para arrumar se uma versão guardada
 * ainda está na nuvem (`inCloud`), ou se dois universos têm o mesmo nome (contando "(importado)").
 */
export function repeatHints(entries: LibraryEntry[], inCloud: (id: string) => boolean, ignored: Set<string> = new Set()): LibraryEntry[][] {
  const own = entries.filter((e) => !e.sample)
  const byId = new Map(own.map((e) => [e.id, e]))
  const groups = new Map<string, LibraryEntry[]>()
  const add = (key: string, e: LibraryEntry) => groups.set(key, [...(groups.get(key) ?? []), e])
  for (const e of own) {
    if (e.cloudCopyOf && byId.has(e.cloudCopyOf)) continue
    add(`${e.kind ?? 'escrita'}:${baseName(cleanName(e.name)).toLocaleLowerCase('pt-BR')}`, e)
  }
  const out: LibraryEntry[][] = []
  for (const mains of groups.values()) {
    const versions = own.filter((v) => v.cloudCopyOf && mains.some((m) => m.id === v.cloudCopyOf))
    const sameName = mains.length > 1 && mains.some((a) => mains.some((b) => a !== b && !ignored.has(pairKey(a.id, b.id))))
    if (sameName || versions.some((v) => inCloud(v.id))) out.push([...mains, ...versions])
  }
  return out
}

/**
 * Confere, abrindo os universos, quais dos candidatos são mesmo o mesmo livro: as versões marcadas
 * e os que têm metade das cenas e fichas em comum. Nomes iguais com histórias diferentes ficam de fora.
 */
export async function confirmRepeats(lib: Library, candidates: LibraryEntry[][]): Promise<RepeatGroup[]> {
  const out: RepeatGroup[] = []
  for (const group of candidates) {
    const loaded = new Map<string, Universe>()
    for (const e of group) {
      const u = await lib.repository(e.id).load()
      if (u) loaded.set(e.id, u)
    }
    // Junta quem é versão marcada de quem, e quem tem as mesmas cenas e fichas.
    const parent = new Map(group.map((e) => [e.id, e.id]))
    const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!))
    const join = (a: string, b: string) => parent.set(find(a), find(b))
    for (const e of group) if (e.cloudCopyOf && parent.has(e.cloudCopyOf)) join(e.id, e.cloudCopyOf)
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const a = loaded.get(group[i].id)
        const b = loaded.get(group[j].id)
        if (a && b && find(a.id) !== find(b.id) && Math.max(sharedShare(a, b), sharedShare(b, a)) >= 0.5) join(a.id, b.id)
      }
    const sets = new Map<string, LibraryEntry[]>()
    for (const e of group) sets.set(find(e.id), [...(sets.get(find(e.id)) ?? []), e])
    for (const entries of sets.values()) {
      if (entries.length < 2) continue
      entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      out.push({ entries, suggested: entries[0].id })
    }
  }
  return out
}

export interface TidyResult {
  /** O universo que ficou. */
  mainId: string
  /** Os que deixaram de ser universo e precisam sair da nuvem (se estavam lá). */
  leaveCloud: string[]
  /** Versões apagadas (por escolha, ou por passar do limite). */
  removed: LibraryEntry[]
}

/**
 * Arruma um grupo de repetidos: `principalId` fica como o universo; os outros viram versões
 * guardadas dele (`keep`) ou são apagados. Se a principal era uma versão, ela troca de lugar com o
 * universo dela, que mantém o id (e a dupla na nuvem). Se a principal não está na nuvem e outro
 * universo do grupo está (`anchored`), também trocam: fica o id que já tem a dupla, os convites e
 * o link de leitura.
 */
export async function tidyGroup(lib: Library, group: RepeatGroup, principalId: string, keep: boolean, anchored: (id: string) => boolean = () => false): Promise<TidyResult> {
  const principal = group.entries.find((e) => e.id === principalId)
  if (!principal) throw new Error('A principal não está no grupo.')
  let mainId = principalId
  const inGroup = (id: string | undefined) => Boolean(id && group.entries.some((e) => e.id === id))
  const anchor = principal.cloudCopyOf || anchored(principalId) ? undefined : group.entries.find((e) => e.id !== principalId && !e.cloudCopyOf && anchored(e.id))
  if (principal.cloudCopyOf && inGroup(principal.cloudCopyOf)) {
    mainId = principal.cloudCopyOf
    await keepVersion(lib, mainId, principalId)
  } else if (anchor) {
    mainId = anchor.id
    await keepVersion(lib, mainId, principalId)
  } else if (principal.cloudCopyOf) {
    // Versão cujo universo não está no grupo: passa a ser o universo.
    const u = await lib.repository(principalId).load()
    if (u) await put(lib, { ...u, name: baseName(u.name), cloudCopyOf: null, versionKind: null })
  } else {
    const u = await lib.repository(principalId).load()
    if (u && u.name !== baseName(u.name)) await put(lib, { ...u, name: baseName(u.name) })
  }
  const others = group.entries.filter((e) => e.id !== mainId)
  const removed: LibraryEntry[] = []
  for (const e of others) {
    if (keep) await demoteToVersion(lib, e.id, mainId, /\((importado|da pasta)\)/.test(e.name) ? 'backup' : 'nuvem')
    else {
      await lib.remove(e.id)
      removed.push(e)
    }
  }
  if (keep) removed.push(...(await trimVersions(lib, mainId)))
  return { mainId, leaveCloud: others.map((e) => e.id), removed }
}
