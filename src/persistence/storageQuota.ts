/** Passou deste tanto (80%) do espaço que o navegador permite: hora de avisar. */
export const QUOTA_WARN = 0.8
/** A partir daqui o aviso é mais forte: salvar pode falhar. */
export const QUOTA_FULL = 0.95

export interface StorageUse {
  /** 0 a 100. */
  percent: number
  level: 'ok' | 'quase' | 'cheio'
}

/** A regra do aviso: `null` se o navegador não diz o espaço (sem aviso). */
export function storageUse(usage: number, quota: number): StorageUse | null {
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0 || usage < 0) return null
  const ratio = usage / quota
  return { percent: Math.min(100, Math.round(ratio * 100)), level: ratio >= QUOTA_FULL ? 'cheio' : ratio >= QUOTA_WARN ? 'quase' : 'ok' }
}

/** Bytes em português ("1,4 MB"). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${(n / 1024 / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
}
