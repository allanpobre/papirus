import { CURRENT_SCHEMA_VERSION, savedFileSchema, type SavedFile } from './schema'

type Data = Record<string, unknown>

/**
 * Cada migração recebe um arquivo na versão N e devolve na versão N + 1.
 * Migrações nunca descartam dados nem trocam IDs existentes.
 */
const migrations: Record<number, (data: Data) => Data> = {
  // v1 → v2: universo ganha fichas, relações, timeline, fatos, RPG etc.;
  // histórias e cenas ganham metadados. Tudo começa vazio.
  1: (data) => {
    const u = data.universe as Data
    return {
      ...data,
      universe: {
        description: '',
        entities: [],
        relations: [],
        events: [],
        facts: [],
        knowledge: [],
        seeds: [],
        groups: [],
        sessions: [],
        revelations: [],
        inbox: [],
        maps: [],
        continuity: [],
        settings: { calendarSuffix: '', dailyWordGoal: 0, ignoredNames: [] },
        dailyStart: {},
        ...u,
        stories: ((u.stories as Data[]) ?? []).map((s) => ({ synopsis: '', ...s })),
        scenes: ((u.scenes as Data[]) ?? []).map((s) => ({
          synopsis: '',
          status: 'rascunho',
          povId: null,
          placeId: null,
          date: null,
          presentIds: [],
          notes: '',
          versions: [],
          ...s,
        })),
      },
    }
  },
}

export class MigrationError extends Error {}

export function migrate(raw: unknown): SavedFile {
  if (typeof raw !== 'object' || raw === null) {
    throw new MigrationError('Arquivo salvo inválido: não é um objeto.')
  }

  let data = raw as Data
  let version = data.schemaVersion

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError('Arquivo salvo inválido: versão de formato ausente ou inválida.')
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `Este arquivo foi salvo por uma versão mais nova do Papirus (formato ${version}). ` +
        'Atualize o aplicativo antes de abri-lo.',
    )
  }
  if (typeof data.universe !== 'object' || data.universe === null) {
    throw new MigrationError('Arquivo salvo inválido: universo ausente.')
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version]
    if (!step) throw new MigrationError(`Não há migração a partir do formato ${version}.`)
    data = { ...step(data), schemaVersion: version + 1 }
    version += 1
  }

  const result = savedFileSchema.safeParse(data)
  if (!result.success) {
    throw new MigrationError(`Arquivo salvo inválido: ${result.error.message}`)
  }
  return result.data
}
