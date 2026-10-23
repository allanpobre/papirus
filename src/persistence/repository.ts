import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type SavedFile, type Universe } from '../model/schema'
import type { KeyValueStore } from './storage'

const keys = (universeId: string) => ({
  current: `universe:${universeId}:current`,
  previous: `universe:${universeId}:previous`,
  snapshots: `universe:${universeId}:snapshots`,
  emergency: `papirus:emergency:${universeId}`,
})
const snapshotKey = (snapshotId: string) => `snapshot:${snapshotId}`

/** Chave usada pela primeira versão, quando só existia um universo. */
const LEGACY_CURRENT = 'universe:current'
const LEGACY_EMERGENCY = 'papirus:emergency'
const LIBRARY_KEY = 'library:index'

/** Snapshots automáticos mantidos por universo. Os nomeados nunca são apagados sozinhos. */
const AUTO_SNAPSHOT_LIMIT = 12
/** Intervalo mínimo entre snapshots automáticos. */
const AUTO_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000

export interface SnapshotInfo {
  id: string
  name: string
  at: string
  auto: boolean
  words: number
}

/**
 * Lê e grava um universo. Antes de cada gravação, a versão anterior é preservada
 * em uma segunda chave, para recuperação em caso de problema.
 *
 * Gravações em IndexedDB são assíncronas e podem não terminar quando a página
 * é fechada. Por isso existe também uma cópia de emergência síncrona, gravada
 * no localStorage ao sair da página e usada no próximo carregamento se for
 * mais recente que a cópia principal.
 */
export class UniverseRepository {
  private revision = 0
  /** Verdadeiro se o último `load` usou a cópia de emergência, que ainda precisa ser salva. */
  recoveredFromEmergency = false
  private readonly store: KeyValueStore
  private readonly emergency: Storage | null
  private readonly k: ReturnType<typeof keys>
  readonly universeId: string

  constructor(store: KeyValueStore, universeId: string, emergency: Storage | null = null) {
    this.store = store
    this.emergency = emergency
    this.universeId = universeId
    this.k = keys(universeId)
  }

  get storeKind() {
    return this.store.kind
  }

  async load(): Promise<Universe | null> {
    const raw = await this.store.get(this.k.current)
    const main = raw === undefined ? null : migrate(raw)
    const rescue = this.readEmergency()

    const file =
      rescue && (!main || rescue.universe.updatedAt > main.universe.updatedAt) ? rescue : main
    this.recoveredFromEmergency = file !== null && file === rescue
    if (!file) return null
    this.revision = Math.max(main?.revision ?? 0, file.revision)
    return file.universe
  }

  async save(universe: Universe): Promise<void> {
    const previous = await this.store.get(this.k.current)
    if (previous !== undefined) {
      await this.store.set(this.k.previous, previous)
      // Outra instância pode ter salvo antes: a revisão nunca volta para trás.
      const prevRevision = (previous as { revision?: unknown }).revision
      if (typeof prevRevision === 'number' && prevRevision > this.revision) this.revision = prevRevision
    }
    await this.store.set(this.k.current, this.toFile(universe, ++this.revision))
    // Só descarta a cópia de emergência se ela não for mais nova que o que acabou de ser salvo.
    const rescue = this.readEmergency()
    if (rescue && rescue.universe.updatedAt <= universe.updatedAt) this.clearEmergency()
    await this.maybeAutoSnapshot(universe)
  }

  /** Grava de forma síncrona uma cópia de emergência. Seguro para chamar em `pagehide`. */
  saveEmergency(universe: Universe): void {
    try {
      this.emergency?.setItem(this.k.emergency, JSON.stringify(this.toFile(universe)))
    } catch {
      // Sem espaço ou sem acesso: a gravação principal ainda pode concluir.
    }
  }

  /** Arquivo completo, no formato salvo, para exportação/backup. */
  toFile(universe: Universe, revision = this.revision): SavedFile {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, revision, universe }
  }

  // -------------------------------------------------------------------------
  // Snapshots

  async listSnapshots(): Promise<SnapshotInfo[]> {
    return ((await this.store.get(this.k.snapshots)) as SnapshotInfo[] | undefined) ?? []
  }

  async createSnapshot(universe: Universe, name: string, auto = false): Promise<SnapshotInfo> {
    const info: SnapshotInfo = {
      id: crypto.randomUUID(),
      name,
      at: new Date().toISOString(),
      auto,
      words: countWords(universe),
    }
    await this.store.set(snapshotKey(info.id), this.toFile(universe))
    let list = [info, ...(await this.listSnapshots())]
    const autos = list.filter((s) => s.auto)
    for (const old of autos.slice(AUTO_SNAPSHOT_LIMIT)) {
      await this.store.delete(snapshotKey(old.id))
      list = list.filter((s) => s.id !== old.id)
    }
    await this.store.set(this.k.snapshots, list)
    return info
  }

  async readSnapshot(snapshotId: string): Promise<Universe> {
    const raw = await this.store.get(snapshotKey(snapshotId))
    if (raw === undefined) throw new Error('Snapshot não encontrado.')
    return migrate(raw).universe
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.store.delete(snapshotKey(snapshotId))
    const list = (await this.listSnapshots()).filter((s) => s.id !== snapshotId)
    await this.store.set(this.k.snapshots, list)
  }

  /** Apaga o universo e tudo ligado a ele neste armazenamento. */
  async destroy(): Promise<void> {
    for (const s of await this.listSnapshots()) await this.store.delete(snapshotKey(s.id))
    await this.store.delete(this.k.snapshots)
    await this.store.delete(this.k.current)
    await this.store.delete(this.k.previous)
    this.clearEmergency()
  }

  private async maybeAutoSnapshot(universe: Universe) {
    const last = (await this.listSnapshots()).find((s) => s.auto)
    if (last && Date.now() - Date.parse(last.at) < AUTO_SNAPSHOT_INTERVAL_MS) return
    await this.createSnapshot(universe, 'Automático', true)
  }

  private readEmergency(): SavedFile | null {
    try {
      const raw = this.emergency?.getItem(this.k.emergency)
      return raw ? migrate(JSON.parse(raw)) : null
    } catch {
      // Cópia de emergência ilegível: ignorada, nunca sobrepõe a principal.
      return null
    }
  }

  private clearEmergency() {
    try {
      this.emergency?.removeItem(this.k.emergency)
    } catch {
      // Ignorado.
    }
  }
}

export interface LibraryEntry {
  id: string
  name: string
  updatedAt: string
  words: number
}

/** Índice dos universos guardados neste navegador. */
export class Library {
  private readonly store: KeyValueStore
  private readonly emergency: Storage | null

  constructor(store: KeyValueStore, emergency: Storage | null = null) {
    this.store = store
    this.emergency = emergency
  }

  get storeKind() {
    return this.store.kind
  }

  repository(universeId: string) {
    return new UniverseRepository(this.store, universeId, this.emergency)
  }

  async list(): Promise<LibraryEntry[]> {
    await this.adoptLegacy()
    const list = ((await this.store.get(LIBRARY_KEY)) as LibraryEntry[] | undefined) ?? []
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** Registra ou atualiza o universo no índice. */
  async touch(universe: Universe): Promise<void> {
    const list = ((await this.store.get(LIBRARY_KEY)) as LibraryEntry[] | undefined) ?? []
    const entry: LibraryEntry = {
      id: universe.id,
      name: universe.name,
      updatedAt: universe.updatedAt,
      words: countWords(universe),
    }
    const i = list.findIndex((e) => e.id === universe.id)
    if (i >= 0) list[i] = entry
    else list.push(entry)
    await this.store.set(LIBRARY_KEY, list)
  }

  async remove(universeId: string): Promise<void> {
    await this.repository(universeId).destroy()
    const list = ((await this.store.get(LIBRARY_KEY)) as LibraryEntry[] | undefined) ?? []
    await this.store.set(
      LIBRARY_KEY,
      list.filter((e) => e.id !== universeId),
    )
  }

  /** Importa o universo salvo pela primeira versão (uma única chave) para o índice. */
  private async adoptLegacy() {
    const legacy = await this.store.get(LEGACY_CURRENT)
    let legacyEmergency: string | null = null
    try {
      legacyEmergency = this.emergency?.getItem(LEGACY_EMERGENCY) ?? null
    } catch {
      legacyEmergency = null
    }
    if (legacy === undefined && !legacyEmergency) return

    const candidates: Universe[] = []
    if (legacy !== undefined) candidates.push(migrate(legacy).universe)
    if (legacyEmergency) {
      try {
        candidates.push(migrate(JSON.parse(legacyEmergency)).universe)
      } catch {
        // Ignorada.
      }
    }
    const newest = candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (newest) {
      await this.repository(newest.id).save(newest)
      await this.touch(newest)
    }
    await this.store.delete(LEGACY_CURRENT)
    try {
      this.emergency?.removeItem(LEGACY_EMERGENCY)
    } catch {
      // Ignorado.
    }
  }
}

export function countWords(universe: Universe): number {
  return universe.scenes.reduce((n, s) => n + wordCount(s.text), 0)
}

export function wordCount(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  return m ? m.length : 0
}
