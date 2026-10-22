import { describe, expect, it } from 'vitest'
import { migrate, MigrationError } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './schema'
import { addScene, createUniverse } from './universe'

const validFile = () => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  revision: 3,
  universe: addScene(createUniverse(), null)[0],
})

describe('migrate', () => {
  it('aceita um arquivo na versão atual sem alterar dados', () => {
    const file = validFile()
    expect(migrate(structuredClone(file))).toEqual(file)
  })

  it('preserva campos desconhecidos do documento do editor', () => {
    const file = validFile()
    file.universe.scenes[0].doc = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { futuro: true } }],
    }
    expect(migrate(structuredClone(file)).universe.scenes[0].doc).toEqual(
      file.universe.scenes[0].doc,
    )
  })

  it('recusa arquivo de uma versão mais nova', () => {
    expect(() => migrate({ ...validFile(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /versão mais nova/,
    )
  })

  it.each([null, 42, 'texto', {}, { schemaVersion: 0 }, { schemaVersion: '1' }])(
    'recusa entrada inválida: %j',
    (raw) => {
      expect(() => migrate(raw)).toThrow(MigrationError)
    },
  )

  it('recusa um universo malformado', () => {
    const file = validFile() as Record<string, unknown>
    file.universe = { id: 'x' }
    expect(() => migrate(file)).toThrow(MigrationError)
  })
})
