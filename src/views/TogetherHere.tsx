import { Users } from 'lucide-react'
import { useWorkspace } from '../state/workspace'

/** Mundo a quatro mãos: quem mais está nesta ficha agora (para não escreverem o mesmo ao mesmo tempo). */
export function TogetherHere({ entityId }: { entityId: string }) {
  const { others } = useWorkspace()
  const here = others.filter((o) => o.entityId === entityId)
  if (!here.length) return null
  const names = here.map((o) => o.who).join(' e ')
  return (
    <p className="together-here small" role="status">
      <Users size={14} aria-hidden="true" /> {names} {here.length === 1 ? 'também está' : 'também estão'} nesta ficha agora. O que cada um escreve se junta em segundos.
    </p>
  )
}
