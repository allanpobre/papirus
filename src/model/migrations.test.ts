import { describe, expect, it } from 'vitest'
import { migrate, MigrationError } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './schema'
import { addScene, createUniverse } from './universe'

const validFile = () => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  revision: 3,
  universe: addScene(createUniverse(), null)[0],
})

/** Um save real no formato 1 (E1), como gravado pela primeira versão. */
const v1File = {
  schemaVersion: 1,
  revision: 7,
  universe: {
    id: 'u1',
    name: 'Mundo antigo',
    stories: [{ id: 's1', title: 'Livro', createdAt: 'a', updatedAt: 'b' }],
    scenes: [
      {
        id: 'c1',
        title: 'Prólogo',
        storyId: 's1',
        order: 0,
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Oi' }] }] },
        text: 'Oi',
        createdAt: 'a',
        updatedAt: 'b',
      },
    ],
    createdAt: 'a',
    updatedAt: 'b',
  },
}

describe('migrate', () => {
  it('aceita um arquivo na versão atual sem alterar dados', () => {
    const file = validFile()
    expect(migrate(structuredClone(file))).toEqual(file)
  })

  it('migra um save do formato 1 preservando IDs, texto e revisão', () => {
    const file = migrate(structuredClone(v1File))
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(file.revision).toBe(7)
    expect(file.universe.id).toBe('u1')
    expect(file.universe.stories[0]).toMatchObject({ id: 's1', title: 'Livro', synopsis: '' })
    expect(file.universe.scenes[0]).toMatchObject({
      id: 'c1',
      text: 'Oi',
      doc: v1File.universe.scenes[0].doc,
      status: 'rascunho',
      presentIds: [],
      date: null,
    })
    expect(file.universe.entities).toEqual([])
    expect(file.universe.settings.ignoredNames).toEqual([])
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

  it.each([null, 42, 'texto', {}, { schemaVersion: 0 }, { schemaVersion: '1' }, { schemaVersion: 1 }])(
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
