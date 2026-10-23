/**
 * Armazenamento local de um único valor por chave.
 * Usa IndexedDB quando disponível e localStorage como alternativa.
 */
export interface KeyValueStore {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory'
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

const DB_NAME = 'papirus'
const STORE = 'kv'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function openIndexedDbStore(factory: IDBFactory = indexedDB): Promise<KeyValueStore> {
  const open = factory.open(DB_NAME, 1)
  open.onupgradeneeded = () => open.result.createObjectStore(STORE)
  const db = await request(open)

  return {
    kind: 'indexeddb',
    get: (key) => request(db.transaction(STORE).objectStore(STORE).get(key)),
    set: (key, value) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
    delete: (key) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  }
}

export function localStorageStore(storage: Storage = localStorage): KeyValueStore {
  const prefix = `${DB_NAME}:`
  return {
    kind: 'localstorage',
    get: async (key) => {
      const raw = storage.getItem(prefix + key)
      return raw === null ? undefined : JSON.parse(raw)
    },
    set: async (key, value) => storage.setItem(prefix + key, JSON.stringify(value)),
    delete: async (key) => storage.removeItem(prefix + key),
  }
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>()
  return {
    kind: 'memory',
    get: async (key) => structuredClone(map.get(key)),
    set: async (key, value) => void map.set(key, structuredClone(value)),
    delete: async (key) => void map.delete(key),
  }
}

/** Abre o melhor armazenamento disponível neste navegador. */
export async function openBestStore(): Promise<KeyValueStore> {
  try {
    if (typeof indexedDB !== 'undefined') return await openIndexedDbStore()
  } catch {
    // IndexedDB indisponível (modo privado, bloqueado etc.): tenta localStorage.
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('papirus:probe', '1')
      localStorage.removeItem('papirus:probe')
      return localStorageStore()
    }
  } catch {
    // localStorage também indisponível.
  }
  return memoryStore()
}

/** Quanto o navegador diz estar usando e quanto permite usar, em bytes. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null
  } catch {
    return null
  }
}

/** Se o navegador já garantiu que não apagará os dados locais sozinho. */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

/** Pede ao navegador para não apagar os dados locais sob pressão de espaço. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
