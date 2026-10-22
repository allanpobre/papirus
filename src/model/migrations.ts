import { CURRENT_SCHEMA_VERSION, savedFileSchema, type SavedFile } from './schema'

/**
 * Cada migração recebe um arquivo na versão N e devolve na versão N + 1.
 * Migrações nunca descartam dados nem trocam IDs existentes.
 */
const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

export class MigrationError extends Error {}

export function migrate(raw: unknown): SavedFile {
  if (typeof raw !== 'object' || raw === null) {
    throw new MigrationError('Arquivo salvo inválido: não é um objeto.')
  }

  let data = raw as Record<string, unknown>
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
