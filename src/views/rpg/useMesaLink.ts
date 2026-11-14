import qrcode from 'qrcode-generator'
import { useMemo, useState } from 'react'
import type { Group } from '../../model/schema'
import { newId, patch } from '../../model/universe'
import { DEFAULT_PUBLIC_URL, deleteCodex, newShareKey, playerLink } from '../../share/server'
import { codexSnapshot } from '../../share/snapshot'
import { publishNow, serverFrom, useSyncState } from '../../share/useCodexSync'
import { useWorkspace } from '../../state/workspace'

/** O link da mesa (Codex ao vivo): ligar, desligar, o endereço e o QR code. */
export function useMesaLink(group: Group) {
  const { universe, update, prefs, toast } = useWorkspace()
  const server = serverFrom(prefs)
  const sync = useSyncState(group.id)
  const [starting, setStarting] = useState(false)
  const share = group.share
  const link = share && server ? playerLink(prefs.publicUrl || DEFAULT_PUBLIC_URL, server, share.id) : ''

  const qr = useMemo(() => {
    if (!link) return ''
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [link])

  const start = async () => {
    if (!server) return false
    setStarting(true)
    const s = { id: newId(), key: newShareKey() }
    const ok = await publishNow(server, group.id, s, codexSnapshot(universe, group.id))
    setStarting(false)
    if (ok) update((u) => patch(u, 'groups', group.id, { share: s }))
    return ok
  }

  const stop = async () => {
    if (!share || !server) return
    try {
      await deleteCodex(server, share.id, share.key)
    } catch {
      // Mesmo sem conexão, a mesa deixa de publicar; o link antigo pode continuar mostrando a última versão.
      toast('Não foi possível apagar do servidor agora. O link para de atualizar.', { tone: 'erro' })
    }
    update((u) => patch(u, 'groups', group.id, { share: null }))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado')
    } catch {
      toast('Não deu para copiar. Selecione o link e copie.', { tone: 'erro' })
    }
  }

  return { server, share, link, qr, sync, starting, start, stop, copy }
}
