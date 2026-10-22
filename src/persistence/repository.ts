import { migrate } from '../model/migrations'
import { CURRENT_SCHEMA_VERSION, type SavedFile, type Universe } from '../model/schema'
import type { KeyValueStore } from './storage'

const CURRENT_KEY = 'universe:current'
const PREVIOUS_KEY = 'universe:previous'
const EMERGENCY_KEY = 'papirus:emergency'

/**
 * Lê e grava o universo atual. Antes de cada gravação, a versão anterior
 * é preservada em uma segunda chave, para recuperação em caso de problema.
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

  constructor(store: KeyValueStore, emergency: Storage | null = null) {
    this.store = store
    this.emergency = emergency
  }

  get storeKind() {
    return this.store.kind
  }

  async load(): Promise<Universe | null> {
    const raw = await this.store.get(CURRENT_KEY)
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
    const previous = await this.store.get(CURRENT_KEY)
    if (previous !== undefined) await this.store.set(PREVIOUS_KEY, previous)
    await this.store.set(CURRENT_KEY, this.toFile(universe, ++this.revision))
    // Só descarta a cópia de emergência se ela não for mais nova que o que acabou de ser salvo.
    const rescue = this.readEmergency()
    if (rescue && rescue.universe.updatedAt <= universe.updatedAt) this.clearEmergency()
  }

  /** Grava de forma síncrona uma cópia de emergência. Seguro para chamar em `pagehide`. */
  saveEmergency(universe: Universe): void {
    try {
      this.emergency?.setItem(EMERGENCY_KEY, JSON.stringify(this.toFile(universe)))
    } catch {
      // Sem espaço ou sem acesso: a gravação principal ainda pode concluir.
    }
  }

  /** Arquivo completo, no formato salvo, para exportação/backup. */
  toFile(universe: Universe, revision = this.revision): SavedFile {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, revision, universe }
  }

  private readEmergency(): SavedFile | null {
    try {
      const raw = this.emergency?.getItem(EMERGENCY_KEY)
      return raw ? migrate(JSON.parse(raw)) : null
    } catch {
      // Cópia de emergência ilegível: ignorada, nunca sobrepõe a principal.
      return null
    }
  }

  private clearEmergency() {
    try {
      this.emergency?.removeItem(EMERGENCY_KEY)
    } catch {
      // Ignorado.
    }
  }
}
