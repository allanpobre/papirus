import { describe, expect, it } from 'vitest'
import { migrate } from '../model/migrations'
import { sampleUniverse } from '../model/sample'
import { CURRENT_SCHEMA_VERSION } from '../model/schema'
import { draftEntity, insert } from '../model/universe'
import { BACKUP_FILE, universeToFiles } from './folderFiles'

describe('universo como arquivos', () => {
  const u = sampleUniverse()
  const file = { schemaVersion: CURRENT_SCHEMA_VERSION, revision: 3, universe: u } as const
  const files = universeToFiles(u, file)
  const paths = files.map((f) => f.path)

  it('inclui um backup completo que reabre igual', () => {
    const backup = files.find((f) => f.path === BACKUP_FILE)!
    expect(migrate(JSON.parse(backup.content)).universe).toEqual(u)
  })

  it('escreve cenas em ordem, por história, e cenas soltas à parte', () => {
    expect(paths).toContain('manuscrito/01-livro-i-a-mare-volta/01-a-chegada.md')
    expect(paths).toContain('manuscrito/01-livro-i-a-mare-volta/02-a-torre-fechada.md')
    expect(paths).toContain('manuscrito/cenas-soltas/01-fragmento-a-cancao-da-mare.md')
    expect(files.find((f) => f.path.endsWith('01-a-chegada.md'))!.content).toMatch(/^# A chegada\n\nEra noite em Ostria/)
  })

  it('escreve fichas por tipo, sem sobrescrever nomes repetidos', () => {
    expect(paths).toContain('fichas/personagens/vaelor.md')
    const [twice] = insert(u, 'entities', draftEntity('personagem', 'Vaelor'))
    const p2 = universeToFiles(twice, { ...file, universe: twice }).map((f) => f.path)
    expect(p2).toContain('fichas/personagens/vaelor.md')
    expect(p2).toContain('fichas/personagens/vaelor-2.md')
  })

  it('inclui o Codex de cada mesa', () => {
    expect(paths).toContain('codex/mesa-de-sexta.md')
  })

  it('não gera caminhos duplicados', () => {
    expect(new Set(paths).size).toBe(paths.length)
  })
})
