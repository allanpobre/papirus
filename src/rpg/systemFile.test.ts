import { describe, expect, it } from 'vitest'
import type { GameSystem } from '../model/schema'
import { gameSystemSchema } from '../model/schema'
import { exportSystem, freeSystemName, readSystemFile, SYSTEM_FILE_FORMAT } from './systemFile'
import { makeSystem, SYSTEM_TEMPLATES } from './systems'

/** O sistema sem ids (as perícias apontam para o atributo pela posição), para comparar antes e depois. */
const shape = (s: { attributes: { id: string }[]; skills: { name: string; attributeId: string | null }[] } & Record<string, unknown>) => {
  const { id: _i, createdAt: _c, updatedAt: _u, attributes, resources, skills, ...rest } = s as Record<string, unknown> & { attributes: { id: string }[]; resources: object[]; skills: { name: string; attributeId: string | null }[] }
  void _i
  void _c
  void _u
  const at = new Map(attributes.map((a, i) => [a.id, i]))
  return {
    ...rest,
    attributes: attributes.map(({ id: _x, ...a }: Record<string, unknown>) => (void _x, a)),
    resources: (resources as Record<string, unknown>[]).map(({ id: _x, ...r }) => (void _x, r)),
    skills: skills.map((k) => ({ name: k.name, attribute: k.attributeId ? (at.get(k.attributeId) ?? null) : null })),
  }
}

describe('sistema em arquivo: ida e volta', () => {
  for (const t of SYSTEM_TEMPLATES) {
    it(`${t.name}: sai e entra igual (com ids novos), sem avisos`, () => {
      const s = makeSystem(t.id)
      const file = exportSystem(s)
      expect(JSON.parse(file)).toMatchObject({ formato: SYSTEM_FILE_FORMAT, versao: 1 })
      // Só a estrutura: nada de ids do sistema, datas ou fichas no arquivo.
      expect(file).not.toContain(s.id)
      expect(file).not.toContain('createdAt')
      const back = readSystemFile(file)
      expect(back.error).toBeUndefined()
      expect(back.warnings).toEqual([])
      expect(shape(back.system as never)).toEqual(shape(s as never))
      // Os ids são novos, e cada perícia aponta para um atributo que existe.
      const ids = back.system!.attributes.map((a) => a.id)
      expect(ids.every((id) => !s.attributes.some((a) => a.id === id))).toBe(true)
      for (const k of back.system!.skills) expect(k.attributeId === null || ids.includes(k.attributeId)).toBe(true)
      // E serve de sistema de verdade (o esquema do app aceita).
      expect(gameSystemSchema.safeParse({ ...back.system, id: 'x', createdAt: '2026-01-01', updatedAt: '2026-01-01' }).success).toBe(true)
    })
  }

  it('o que o editor mudou (nome, condições, fórmula) vai junto', () => {
    const s: GameSystem = { ...makeSystem('d20-5e'), name: 'Minha casa', conditions: ['Sangrando', 'Em chamas'], initiativeFormula: '1d20+{DES}' }
    const back = readSystemFile(exportSystem(s))
    expect(back.system).toMatchObject({ name: 'Minha casa', conditions: ['Sangrando', 'Em chamas'], initiativeFormula: '1d20+{DES}' })
  })
})

describe('sistema em arquivo: o que não é um sistema, ou veio quebrado', () => {
  it('recusa o que não é um sistema, com a razão', () => {
    expect(readSystemFile('isto não é json').error).toMatch(/não consegui ler/)
    expect(readSystemFile('{"a":1}').error).toMatch(/não parece um sistema do Papirus/)
    expect(readSystemFile(JSON.stringify({ formato: 'papirus-universo', versao: 1, sistema: {} })).error).toMatch(/não parece um sistema/)
    expect(readSystemFile('x'.repeat(600_000)).error).toMatch(/grande demais/)
    expect(readSystemFile('{"a":1}').system).toBeNull()
  })

  it('traz o que dá e avisa do que ficou de fora', () => {
    const s = makeSystem('d20-5e')
    const file = JSON.parse(exportSystem(s))
    // Um atributo sem a sigla, uma perícia apontando para um atributo que não existe, regra e modo desconhecidos.
    delete file.sistema.attributes[2].abbr
    file.sistema.skills[0].attributeId = 'nao-existe'
    file.sistema.modifierRule = 'inventada'
    file.sistema.resolution = 'outra'
    file.versao = 9
    const r = readSystemFile(JSON.stringify(file))
    expect(r.system).not.toBeNull()
    expect(r.system!.attributes).toHaveLength(s.attributes.length - 1)
    expect(r.system!.skills[0].attributeId).toBeNull()
    expect(r.system).toMatchObject({ modifierRule: 'nenhum', resolution: 'total' })
    expect(r.warnings.join(' | ')).toContain('Atributo 3 ficou de fora')
    expect(r.warnings.join(' | ')).toContain('apontava para um atributo que não veio')
    expect(r.warnings.join(' | ')).toContain('regra de modificador não foi reconhecida')
    expect(r.warnings.join(' | ')).toContain('jeito de ler a rolagem não foi reconhecido')
    expect(r.warnings.join(' | ')).toContain('versão mais nova')
  })

  it('uma fórmula que não funciona entra, mas avisa; sem nome vira "Sistema importado"', () => {
    const file = JSON.parse(exportSystem(makeSystem('d20-5e')))
    file.sistema.initiativeFormula = '{XYZ}d20+++'
    delete file.sistema.name
    const r = readSystemFile(JSON.stringify(file))
    expect(r.system!.initiativeFormula).toBe('{XYZ}d20+++')
    expect(r.system!.name).toBe('Sistema importado')
    expect(r.warnings.join(' | ')).toMatch(/fórmula de iniciativa .* não funciona/)
    expect(r.warnings.join(' | ')).toContain('não tinha o nome do sistema')
  })

  it('listas enormes são cortadas (o arquivo não derruba o app)', () => {
    const file = JSON.parse(exportSystem(makeSystem('d20-5e')))
    file.sistema.skills = Array.from({ length: 800 }, (_, i) => ({ id: `s${i}`, name: `Perícia ${i}`, attributeId: null }))
    file.sistema.conditions = Array.from({ length: 200 }, (_, i) => `Condição ${i}`)
    const r = readSystemFile(JSON.stringify(file))
    expect(r.system!.skills).toHaveLength(300)
    expect(r.system!.conditions).toHaveLength(80)
    expect(r.warnings.join(' | ')).toContain('só os primeiros 300 entraram (o arquivo tinha 800)')
  })

  it('texto com HTML ou script fica como texto (nada é executado: o sistema só guarda strings)', () => {
    const file = JSON.parse(exportSystem(makeSystem('d20-5e')))
    file.sistema.name = '<img src=x onerror=alert(1)>'
    const r = readSystemFile(JSON.stringify(file))
    expect(r.system!.name).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('nome livre', () => {
  it('não repete o de um sistema que já existe', () => {
    expect(freeSystemName('D&D', [])).toBe('D&D')
    expect(freeSystemName('D&D', ['d&d'])).toBe('D&D (2)')
    expect(freeSystemName('D&D', ['D&D', 'D&D (2)'])).toBe('D&D (3)')
  })
})
