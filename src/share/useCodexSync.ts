import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Universe } from '../model/schema'
import type { Prefs } from '../state/prefs'
import { BUILD_SERVER, isConfigured, publishCodex, type ServerConfig } from './server'
import { codexSnapshot, sameContent, type CodexSnapshot } from './snapshot'
import { imageDataUrl, imageThumbDataUrl } from '../images/resolve'

export type SyncState = { state: 'publicando' | 'ok' | 'erro'; at?: string; error?: string }

/** Estado da publicação de cada mesa, para a tela do Codex mostrar. */
const states = new Map<string, SyncState>()
const listeners = new Set<() => void>()
const setState = (groupId: string, s: SyncState) => {
  states.set(groupId, s)
  for (const l of listeners) l()
}

export function useSyncState(groupId: string): SyncState | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => states.get(groupId),
  )
}

export const serverFrom = (prefs: Prefs): ServerConfig | null => (isConfigured(prefs.server) ? prefs.server : BUILD_SERVER)

/** Publica de novo agora (botão "Tentar de novo" e início do compartilhamento). */
export async function publishNow(server: ServerConfig, groupId: string, share: { id: string; key: string }, snapshot: CodexSnapshot) {
  setState(groupId, { state: 'publicando' })
  try {
    // Os jogadores não têm conta: as imagens dos mapas vão dentro do Codex.
    const maps = await Promise.all(snapshot.maps.map(async (m) => ({ ...m, image: (await imageDataUrl(m.image)) ?? '' })))
    // Retratos: miniaturas pequenas, para o Codex continuar leve no celular dos jogadores.
    const sections = await Promise.all(
      snapshot.sections.map(async (sec) => ({
        ...sec,
        entries: await Promise.all(
          sec.entries.map(async ({ image, ...e }) => {
            const thumb = image ? await imageThumbDataUrl(image) : null
            return thumb ? { ...e, image: thumb } : e
          }),
        ),
      })),
    )
    const at = await publishCodex(server, share.id, share.key, { ...snapshot, maps, sections })
    setState(groupId, { state: 'ok', at })
    return true
  } catch (err) {
    setState(groupId, { state: 'erro', error: err instanceof Error ? err.message : String(err) })
    return false
  }
}

/**
 * Mantém os Codex compartilhados em dia: depois de uma pausa nas mudanças, publica
 * o retrato de cada mesa compartilhada que mudou. Fica montado enquanto o universo está aberto.
 */
export function useCodexSync(universe: Universe, prefs: Prefs) {
  const last = useRef(new Map<string, CodexSnapshot>())
  const server = serverFrom(prefs)

  useEffect(() => {
    if (!server) return
    const shared = universe.groups.filter((g) => g.share)
    if (!shared.length) return
    const timer = setTimeout(() => {
      for (const g of shared) {
        const snap = codexSnapshot(universe, g.id)
        const prev = last.current.get(g.id)
        if (prev && sameContent(prev, snap)) continue
        last.current.set(g.id, snap)
        void publishNow(server, g.id, g.share!, snap).then((ok) => {
          if (!ok) last.current.delete(g.id)
        })
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [universe, server])
}
