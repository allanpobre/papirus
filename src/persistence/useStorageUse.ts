import { useEffect, useState } from 'react'
import { storageEstimate } from './storage'
import { storageUse, type StorageUse } from './storageQuota'

/** O espaço usado no navegador (pelo `navigator.storage.estimate()`), conferido ao abrir e de tempos em tempos. */
export function useStorageUse(): (StorageUse & { usage: number; quota: number }) | null {
  const [use, setUse] = useState<(StorageUse & { usage: number; quota: number }) | null>(null)
  useEffect(() => {
    let off = false
    const check = () =>
      void storageEstimate().then((e) => {
        const u = e ? storageUse(e.usage, e.quota) : null
        if (!off) setUse(u && e ? { ...u, usage: e.usage, quota: e.quota } : null)
      })
    check()
    const t = setInterval(check, 5 * 60_000)
    return () => {
      off = true
      clearInterval(t)
    }
  }, [])
  return use
}
