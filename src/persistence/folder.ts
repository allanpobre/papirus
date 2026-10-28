import { IMAGE_EXTS, imageFileName, imagesChanged, saveFolderImage, storedBlob } from '../images/backup'
import { imageIdsIn } from '../images/ref'
import type { SavedFile, Universe } from '../model/schema'
import { BACKUP_FILE, MANIFEST, universeToFiles } from './folderFiles'
import type { KeyValueStore } from './storage'

/* Tipos mínimos da File System Access API (ainda fora do lib.dom do TypeScript). */
interface PermissionDescriptor {
  mode: 'read' | 'readwrite'
}
export interface DirHandle {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>
    getFile(): Promise<File>
  }>
  removeEntry(name: string): Promise<void>
  queryPermission(d: PermissionDescriptor): Promise<PermissionState>
  requestPermission(d: PermissionDescriptor): Promise<PermissionState>
}

type PickerWindow = Window & { showDirectoryPicker?: (o?: { mode?: 'readwrite' | 'read'; id?: string }) => Promise<DirHandle> }

/** Navegadores com acesso a pastas (Chrome, Edge, Opera). Firefox e Safari ainda não. */
export const supportsFolders = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'

export async function pickFolder(mode: 'readwrite' | 'read' = 'readwrite'): Promise<DirHandle> {
  return (window as PickerWindow).showDirectoryPicker!({ mode, id: 'papirus' })
}

const handleKey = (universeId: string) => `folder:${universeId}`

/** Lembra a pasta escolhida (só funciona com IndexedDB, que guarda o "atalho" da pasta). */
export async function rememberFolder(store: KeyValueStore, universeId: string, handle: DirHandle | null) {
  if (store.kind !== 'indexeddb') return
  if (handle) await store.set(handleKey(universeId), handle)
  else await store.delete(handleKey(universeId))
}

export async function recallFolder(store: KeyValueStore, universeId: string): Promise<DirHandle | null> {
  if (store.kind !== 'indexeddb') return null
  return ((await store.get(handleKey(universeId))) as DirHandle | undefined) ?? null
}

/** Se o navegador já deu (ou ainda dá) permissão de escrita nesta pasta. */
export async function hasPermission(handle: DirHandle, ask = false): Promise<boolean> {
  const d: PermissionDescriptor = { mode: 'readwrite' }
  if ((await handle.queryPermission(d)) === 'granted') return true
  return ask ? (await handle.requestPermission(d)) === 'granted' : false
}

async function dirFor(root: DirHandle, parts: string[]): Promise<DirHandle> {
  let dir = root
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true })
  return dir
}

async function exists(root: DirHandle, path: string): Promise<boolean> {
  try {
    const parts = path.split('/')
    let dir = root
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    await dir.getFileHandle(parts[parts.length - 1])
    return true
  } catch {
    return false
  }
}

async function writeText(root: DirHandle, path: string, content: string | Blob) {
  const parts = path.split('/')
  const dir = await dirFor(root, parts.slice(0, -1))
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true })
  const w = await fh.createWritable()
  await w.write(content)
  await w.close()
}

async function readText(root: DirHandle, path: string): Promise<string | null> {
  try {
    const parts = path.split('/')
    let dir = root
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    const f = await (await dir.getFileHandle(parts[parts.length - 1])).getFile()
    return await f.text()
  } catch {
    return null
  }
}

/**
 * Escreve o universo na pasta. Arquivos que o próprio Papirus escreveu antes e
 * não existem mais (cena renomeada, ficha apagada) são removidos; nada mais é tocado.
 */
export async function writeUniverseToFolder(root: DirHandle, universe: Universe, file: SavedFile): Promise<number> {
  const files = universeToFiles(universe, file)
  const previous: string[] = JSON.parse((await readText(root, MANIFEST)) ?? '[]')
  for (const f of files) await writeText(root, f.path, f.content)
  const current = new Set(files.map((f) => f.path))
  // Imagens: cada uma num arquivo em imagens/, escrito só uma vez (o nome é o conteúdo).
  for (const id of imageIdsIn(universe)) {
    const blob = await storedBlob(id)
    if (!blob) continue
    const path = `imagens/${imageFileName(id, blob.type)}`
    current.add(path)
    if (!(await exists(root, path))) await writeText(root, path, blob)
  }
  for (const old of previous) {
    if (current.has(old)) continue
    try {
      const parts = old.split('/')
      let dir = root
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
      await dir.removeEntry(parts[parts.length - 1])
    } catch {
      // Já não existe: tudo bem.
    }
  }
  await writeText(root, MANIFEST, JSON.stringify([...current], null, 2))
  return files.length
}

/** Lê o backup completo de uma pasta salva pelo Papirus. */
export async function readBackupFromFolder(root: DirHandle): Promise<unknown> {
  const text = await readText(root, BACKUP_FILE)
  if (text === null) throw new Error(`Esta pasta não tem o arquivo ${BACKUP_FILE} do Papirus.`)
  const raw: unknown = JSON.parse(text)
  // As imagens do universo, da pasta imagens/.
  let n = 0
  for (const id of imageIdsIn(raw)) {
    for (const ext of IMAGE_EXTS) {
      try {
        const f = await (await (await root.getDirectoryHandle('imagens')).getFileHandle(`${id}.${ext}`)).getFile()
        await saveFolderImage(id, f)
        n++
        break
      } catch {
        // Tenta a próxima extensão.
      }
    }
  }
  if (n) imagesChanged()
  return raw
}
