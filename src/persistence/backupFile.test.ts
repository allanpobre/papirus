import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { recall, remember } from '../state/prefs'
import { backupOf, restoreBackupExtras } from './backupFile'
import { Library } from './repository'
import { memoryStore } from './storage'

describe('backup completo: ida e volta', () => {
  beforeAll(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) })
  })

  it('leva as versões guardadas (não as automáticas) e o livro escolhido; volta tudo sem repetir', async () => {
    const lib = new Library(memoryStore())
    const u = ostriaUniverse()
    const repo = lib.repository(u.id)
    await repo.save(u)
    await repo.createSnapshot({ ...u, name: 'Antes do fim' }, 'Antes do fim')
    await repo.createSnapshot(u, 'automática', true)
    remember(`livro:${u.id}`, u.stories[0].id)

    const file = JSON.parse(JSON.stringify(await backupOf(repo, u))) as { versions?: { info: { name: string } }[]; device?: { book: string } }
    expect(file.versions?.map((v) => v.info.name)).toEqual(['Antes do fim'])
    expect(file.device?.book).toBe(u.stories[0].id)

    // Noutro aparelho (outro armazenamento, sem o livro escolhido).
    remember(`livro:${u.id}`, null)
    const other = new Library(memoryStore()).repository(u.id)
    expect(await restoreBackupExtras(other, file, u.id)).toBe(1)
    const back = await other.listSnapshots()
    expect(back.map((s) => s.name)).toEqual(['Antes do fim'])
    expect((await other.readSnapshot(back[0].id)).name).toBe('Antes do fim')
    expect(recall(`livro:${u.id}`)).toBe(u.stories[0].id)
    // De novo: não repete.
    expect(await restoreBackupExtras(other, file, u.id)).toBe(0)
    // Backup antigo (só o universo): nada quebra.
    expect(await restoreBackupExtras(other, { schemaVersion: 1, universe: u }, u.id)).toBe(0)
  })
})
