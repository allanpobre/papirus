import { fold } from '../logic/text'
import type { Universe } from '../model/schema'
import { draftEntity, insert, patch } from '../model/universe'

/*
 * Um personagem só: o personagem de jogo (a ficha da Mesa) e o personagem do Mundo são o mesmo.
 * Criar um personagem de jogador na Mesa cria a ficha dele no Mundo, ou liga a uma que já existe.
 */

/** O personagem do Mundo com este nome (ou apelido), se houver. */
export function worldMatch(u: Universe, name: string): string | null {
  const k = fold(name.trim())
  if (!k) return null
  const found = u.entities.find((e) => e.kind === 'personagem' && (fold(e.name.trim()) === k || e.aliases.some((a) => fold(a.trim()) === k)))
  return found?.id ?? null
}

/** Liga a ficha de jogo ao personagem do Mundo de mesmo nome, ou cria a ficha do Mundo. */
export function linkToWorld(u: Universe, sheetId: string): Universe {
  const sheet = u.sheets.find((s) => s.id === sheetId)
  if (!sheet || sheet.entityId || !sheet.name.trim()) return u
  let next = u
  let id = worldMatch(u, sheet.name)
  if (!id) {
    const [withEntity, entity] = insert(u, 'entities', draftEntity('personagem', sheet.name.trim()))
    next = withEntity
    id = entity.id
  }
  return patch(next, 'sheets', sheet.id, { entityId: id })
}

/**
 * Uma vez por universo: os personagens de jogador de antes ganham a ficha no Mundo (ou ligam à de
 * mesmo nome). Os NPCs ficam como estão: ganham ficha quando o mestre pedir.
 */
export function linkPlayerSheets(u: Universe): Universe {
  let next = u
  for (const s of u.sheets) if (s.role === 'pj' && !s.entityId) next = linkToWorld(next, s.id)
  return next
}

/** As fichas de jogo de um personagem do Mundo. */
export const sheetsOf = (u: Universe, entityId: string) => u.sheets.filter((s) => s.entityId === entityId)

/** Uma sessão em que a ficha aparece, e por quê. */
export interface SessionAppearance {
  sessionId: string
  label: string
  why: string[]
}

/**
 * As sessões em que esta ficha do Mundo aparece: jogou (ou o mestre conduziu), foi revelada ao
 * grupo, ou é citada no resumo ("O que aconteceu?"). Só sessões já jogadas ou ao vivo.
 */
export function sessionsOf(u: Universe, entityId: string): SessionAppearance[] {
  const entity = u.entities.find((e) => e.id === entityId)
  if (!entity) return []
  const names = [entity.name, ...entity.aliases].map((n) => fold(n.trim())).filter((n) => n.length > 1)
  const mentions = (text: string) => {
    const t = fold(text)
    return names.some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(t))
  }
  const sheets = sheetsOf(u, entityId)
  const out: SessionAppearance[] = []
  const played = [...u.sessions].filter((s) => s.status !== 'planejada').sort((a, b) => a.number - b.number)
  for (const s of played) {
    const why: string[] = []
    for (const sheet of sheets) {
      if (sheet.groupId !== s.groupId) continue
      const a = s.attendance[sheet.id] ?? 'joga'
      if (a === 'joga') why.push(sheet.role === 'pj' ? 'jogou' : 'em cena')
      else if (a === 'mestre') why.push('o mestre conduziu')
    }
    if (u.revelations.some((r) => r.sessionId === s.id && r.target === 'entidade' && r.targetId === entityId)) why.push('revelado')
    if (s.recap.trim() && mentions(s.recap)) why.push('no resumo')
    if (why.length) out.push({ sessionId: s.id, label: `Sessão ${s.number}${s.title.trim() && s.title.trim() !== `Sessão ${s.number}` ? ` — ${s.title.trim().replace(/^Sessão \d+\s*[—:-]\s*/, '')}` : ''}`, why: [...new Set(why)] })
  }
  return out
}
