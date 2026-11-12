import type { Universe } from './schema'
import type { View } from '../state/workspace'

/**
 * Os setores do Papirus: um universo é de escrita (livro, contos), uma campanha de RPG ou um
 * mundo (só worldbuilding). O tipo decide em que setor ele aparece, em que tela abre e o que o menu mostra.
 */
export type UniverseKind = 'escrita' | 'campanha' | 'mundo'
export type WorldLevel = 'simples' | 'completo'

export function universeKind(u: Universe): UniverseKind {
  if (u.settings.kind) return u.settings.kind
  // Universos de antes dos setores: mesa montada e nada escrito nas cenas é campanha.
  return u.groups.length > 0 && u.scenes.every((s) => !s.text.trim()) ? 'campanha' : 'escrita'
}

/** O que uma campanha esconde do menu: a parte de escrever o livro. (A Oficina fica: tem guias para mestres.) */
export const CAMPAIGN_HIDDEN: View[] = ['escrever', 'organizar', 'livro', 'conhecimento']

/** O que um mundo esconde do menu: escrever e publicar o livro e a Mesa (ligam-se quando quiser). */
export const WORLD_HIDDEN: View[] = ['escrever', 'organizar', 'livro', 'rpg']
/** O que o nível Simples esconde a mais: a Trama (pistas e quem sabe o quê). */
export const SIMPLE_HIDDEN: View[] = ['tramas', 'conhecimento']

/** Simples ou Completo (só vale num mundo; os outros tipos são sempre completos). */
export const worldLevel = (u: Universe): WorldLevel => (universeKind(u) === 'mundo' && u.settings.worldLevel === 'simples' ? 'simples' : 'completo')

/** Atalhos da barra de baixo no celular, num mundo. */
export const WORLD_SHORTCUTS: View[] = ['inicio', 'fichas', 'wiki', 'inbox']

/** Atalhos da barra de baixo no celular, numa campanha. */
export const CAMPAIGN_SHORTCUTS: View[] = ['rpg', 'fichas', 'tramas', 'inbox']

/**
 * Áreas escondidas do menu neste universo: o que a pessoa escolheu para esse tipo, ou o
 * padrão dele. Num universo de escrita, a mesa só aparece se já tiver uma.
 */
export function hiddenViewsFor(u: Universe, menus: Partial<Record<UniverseKind, View[]>>, legacy: View[] = []): View[] {
  const kind = universeKind(u)
  // A área Wiki é só dos mundos.
  return kind === 'mundo' ? hiddenFor(u, kind, menus, legacy) : [...hiddenFor(u, kind, menus, legacy), 'wiki']
}

function hiddenFor(u: Universe, kind: UniverseKind, menus: Partial<Record<UniverseKind, View[]>>, legacy: View[]): View[] {
  const saved = menus[kind]
  if (kind === 'mundo') {
    const base = saved ?? WORLD_HIDDEN
    return worldLevel(u) === 'simples' ? [...new Set([...base, ...SIMPLE_HIDDEN])] : base
  }
  if (saved) return saved
  if (kind === 'campanha') return CAMPAIGN_HIDDEN
  // O "Só RPG" de antes (que tirava o Livro) não vale para quem escreve.
  const base = legacy.includes('livro') ? [] : legacy.filter((v) => v !== 'rpg')
  return u.groups.length > 0 ? base : [...base, 'rpg']
}

/** A tela em que o universo abre pela primeira vez. */
export const firstView = (u: Universe): View => (universeKind(u) === 'campanha' ? 'rpg' : 'inicio')
