import { embeddedImages } from '../images/backup'
import { migrate } from '../model/migrations'
import type { SavedFile, Universe } from '../model/schema'
import { recall, remember } from '../state/prefs'
import type { SnapshotInfo, UniverseRepository } from './repository'

/*
 * O arquivo de backup de um universo, completo: o universo, as imagens (dentro, como data URLs), as versões
 * guardadas com nome (as automáticas não: voltam a nascer sozinhas) e, deste aparelho, o livro escolhido no
 * alto. Quem lê um backup antigo (só o universo) continua lendo; o que falta só não vem.
 */

interface BackupVersion {
  info: SnapshotInfo
  file: SavedFile
}

/** O backup completo, pronto para virar JSON. */
export async function backupOf(repo: UniverseRepository, universe: Universe): Promise<SavedFile & Record<string, unknown>> {
  const file = repo.toFile(universe)
  const versions: BackupVersion[] = []
  for (const info of (await repo.listSnapshots().catch(() => [])).filter((s) => !s.auto)) {
    try {
      versions.push({ info, file: repo.toFile(await repo.readSnapshot(info.id), 0) })
    } catch {
      // Versão ilegível: fica de fora (o resto do backup vale).
    }
  }
  const images = await embeddedImages([universe, ...versions.map((v) => v.file.universe)]).catch(() => ({}))
  const book = recall(`livro:${universe.id}`)
  return {
    ...file,
    ...(Object.keys(images).length ? { images } : {}),
    ...(versions.length ? { versions } : {}),
    ...(book ? { device: { book } } : {}),
  }
}

/**
 * Depois de restaurar o universo de um backup: as versões guardadas voltam para ele (sem repetir as que já estão)
 * e o livro escolhido volta para este aparelho. Devolve quantas versões entraram.
 */
export async function restoreBackupExtras(repo: UniverseRepository, raw: unknown, universeId: string): Promise<number> {
  const data = (raw ?? {}) as { versions?: unknown; device?: { book?: unknown } }
  let n = 0
  if (Array.isArray(data.versions))
    for (const v of data.versions as BackupVersion[]) {
      try {
        if (!v?.info?.id || typeof v.info.name !== 'string') continue
        if (await repo.importSnapshot(v.info, migrate(v.file).universe)) n++
      } catch {
        // Versão estragada no arquivo: pula.
      }
    }
  if (typeof data.device?.book === 'string') remember(`livro:${universeId}`, data.device.book)
  return n
}
