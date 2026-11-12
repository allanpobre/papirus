import { RefreshCw, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { upload } from '../account/cloud'
import { originState, pullOriginal } from '../logic/au'
import { getShare, invite, listMembers, normalizeEmail, openShared, shareChanged, shortName, startSharing } from '../share/sharing'
import { useWorkspace } from '../state/workspace'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * A faixa de um universo alternativo (AU): de quem é o mundo original, trazer as novidades de lá
 * e mostrar o AU ao autor, para ele escolher o que vira canon.
 */
export function AUBanner() {
  const { universe, update, toast, flush } = useWorkspace()
  const { user, server } = useAccount()
  const [busy, setBusy] = useState(false)
  const from = universe.derivedFrom
  if (!from) return null
  const owner = shortName(from.ownerEmail) || 'o autor'

  const run = async (fn: () => Promise<void>) => {
    if (!user || !server) {
      toast('Entre na sua conta para falar com o mundo original.')
      return
    }
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const pull = () =>
    run(async () => {
      const sb = await authClient(server!)
      const { universe: fresh } = await openShared(sb, { owner_id: from.ownerId, universe_id: from.universeId, role: 'ver' })
      const r = pullOriginal(universe, fresh)
      update((u) => pullOriginal(u, fresh).universe)
      const parts = [r.added && `${plural(r.added, 'coisa nova', 'coisas novas')}`, r.updated && `${plural(r.updated, 'atualizada', 'atualizadas')}`, r.removed && `${plural(r.removed, 'saiu', 'saíram')}`].filter(Boolean)
      toast(
        (parts.length ? `Do original: ${parts.join(', ')}.` : 'Nada novo no original.') +
          (r.kept ? ` ${plural(r.kept, 'ficha que você mudou ficou', 'fichas que você mudou ficaram')} do seu jeito.` : ''),
      )
    })

  const show = () =>
    run(async () => {
      await flush()
      const sb = await authClient(server!)
      const me = user!
      let share = await getShare(sb, me.id, universe.id)
      if (!share) {
        await upload(sb, me.id, universe)
        share = await startSharing(sb, me.id, me.email ?? '', universe)
      }
      const who = normalizeEmail(from.ownerEmail)
      const members = await listMembers(sb, me.id, universe.id)
      if (!members.some((m) => m.email === who)) await invite(sb, share, who, 'ver')
      shareChanged()
      toast(`Pronto: ${owner} já pode ver este AU (em Compartilhar) e escolher o que vira canon.`)
    })

  return (
    <div className="shared-banner au-banner" role="status">
      <Sparkles size={15} aria-hidden="true" />
      <span>
        Universo alternativo de <strong>“{from.name}”</strong>, de <strong>{owner}</strong>. As histórias de lá são lore: dá para ler, não para mudar.
      </span>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void pull()}>
        <RefreshCw size={14} /> Novidades do original
      </button>
      <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void show()}>
        <Send size={14} /> Mostrar ao autor
      </button>
    </div>
  )
}

/** Num AU, de onde vem uma ficha: do original (igual ou mudada aqui). As nascidas no AU ficam sem selo. */
export function OriginChip({ item, full = false }: { item: { id: string }; full?: boolean }) {
  const { universe } = useWorkspace()
  const state = originState(universe, item)
  if (!state || (state === 'novo' && !full)) return null
  const label = state === 'original' ? 'Original' : state === 'mudou' ? 'Mudou no AU' : 'Nasceu no AU'
  const title =
    state === 'original'
      ? `Veio de “${universe.derivedFrom?.name}”, do jeito que está lá`
      : state === 'mudou'
        ? `Veio de “${universe.derivedFrom?.name}” e foi mudada neste AU`
        : 'Criada neste AU'
  return (
    <span className={`au-chip au-chip-${state}`} title={title}>
      {label}
    </span>
  )
}
