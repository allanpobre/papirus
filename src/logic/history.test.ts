import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { addScene, createUniverse, removeEntity, updateScene } from '../model/universe'
import { purgeTrash, restoreTrash, revertTo, track } from './history'

describe('lixeira e histórico', () => {
  const u = sampleUniverse()
  const kael = u.entities.find((e) => e.name === 'Kael')!

  it('apagar leva o item (e o que saiu junto) para a lixeira, e dá para recuperar', () => {
    const after = track(u, removeEntity(u, kael.id), 'ana')
    expect(after.trash).toHaveLength(1)
    expect(after.trash[0].label).toMatch(/^Kael \(e \d+ relaç/)
    expect(after.history[0]).toMatchObject({ action: 'apagou', label: 'Kael', by: 'ana' })
    const back = restoreTrash(after, after.trash[0].id, 'bia')
    expect(back.entities.some((e) => e.id === kael.id)).toBe(true)
    expect(back.relations.length).toBe(u.relations.length)
    expect(back.trash).toHaveLength(0)
    expect(back.history[0]).toMatchObject({ action: 'recuperou', by: 'bia' })
  })

  it('edições seguidas viram uma linha; dá para voltar como estava', () => {
    const [base, scene] = addScene(createUniverse(), null, 'Cena')
    const t0 = new Date('2026-01-01T10:00:00Z')
    let v = track(base, updateScene(base, scene.id, { synopsis: 'um' }), 'ana', t0)
    v = track(v, updateScene(v, scene.id, { synopsis: 'dois' }), 'ana', new Date('2026-01-01T10:05:00Z'))
    expect(v.history.filter((h) => h.recordId === scene.id)).toHaveLength(1)
    // Outra pessoa: nova linha.
    v = track(v, updateScene(v, scene.id, { synopsis: 'três' }), 'bia', new Date('2026-01-01T10:06:00Z'))
    expect(v.history.filter((h) => h.recordId === scene.id)).toHaveLength(2)
    const back = revertTo(v, v.history[0].id, 'ana')
    expect(back.scenes[0].synopsis).toBe('dois')
  })

  it('a lixeira esquece depois de 30 dias', () => {
    const after = track(u, removeEntity(u, kael.id), null, new Date('2026-01-01T00:00:00Z'))
    expect(purgeTrash(after, Date.parse('2026-01-20T00:00:00Z')).trash).toHaveLength(1)
    expect(purgeTrash(after, Date.parse('2026-02-05T00:00:00Z')).trash).toHaveLength(0)
  })
})
