/** As imagens guardadas neste navegador (IndexedDB), pelo id do conteúdo. */
export interface StoredImage {
  id: string
  blob: Blob
  width: number
  height: number
  /** Quando entrou neste aparelho. */
  at: string
}

const DB = 'papirus-imagens'
const STORE = 'imagens'

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory = new Map<string, StoredImage>()

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const open = indexedDB.open(DB, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' })
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => resolve(null)
      open.onblocked = () => resolve(null)
    } catch {
      // Sem IndexedDB (modo privado antigo): as imagens valem só nesta visita.
      resolve(null)
    }
  })
  return dbPromise
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  if (!d) throw new Error('sem IndexedDB')
  const t = d.transaction(STORE, mode)
  const result = req(run(t.objectStore(STORE)))
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
  return result
}

/** Id de uma imagem: o começo do SHA-256 do conteúdo (a mesma imagem tem sempre o mesmo id). */
export async function imageId(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer()
  if (globalThis.crypto?.subtle) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return crypto.randomUUID().replace(/-/g, '')
}

export async function saveImage(img: Omit<StoredImage, 'at'>): Promise<void> {
  const rec: StoredImage = { ...img, at: new Date().toISOString() }
  try {
    await tx('readwrite', (s) => s.put(rec))
  } catch {
    memory.set(rec.id, rec)
  }
}

export async function loadImage(id: string): Promise<StoredImage | undefined> {
  try {
    return (await tx('readonly', (s) => s.get(id) as IDBRequest<StoredImage | undefined>)) ?? memory.get(id)
  } catch {
    return memory.get(id)
  }
}

export async function listImages(): Promise<StoredImage[]> {
  try {
    return [...(await tx('readonly', (s) => s.getAll() as IDBRequest<StoredImage[]>)), ...memory.values()]
  } catch {
    return [...memory.values()]
  }
}

export async function deleteImage(id: string): Promise<void> {
  memory.delete(id)
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch {
    // Já não estava lá.
  }
}
