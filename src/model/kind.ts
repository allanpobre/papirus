import type { Universe } from './schema'
import type { View } from '../state/workspace'

/**
 * Os setores do Papirus: um universo é de escrita (livro, contos) ou uma campanha de RPG.
 * O tipo decide em que setor ele aparece, em que tela abre e o que o menu mostra.
 */
export type UniverseKind = 'escrita' | 'campanha'

export function universeKind(u: Universe): UniverseKind {
  if (u.settings.kind) return u.settings.kind
  // Universos de antes dos setores: mesa montada e nada escrito nas cenas é campanha.
  return u.groups.length > 0 && u.scenes.every((s) => !s.text.trim()) ? 'campanha' : 'escrita'
}

/** O que uma campanha esconde do menu: a parte de escrever o livro. (A Oficina fica: tem guias para mestres.) */
export const CAMPAIGN_HIDDEN: View[] = ['escrever', 'organizar', 'livro', 'conhecimento']

/** Atalhos da barra de baixo no celular, numa campanha. */
export const CAMPAIGN_SHORTCUTS: View[] = ['rpg', 'fichas', 'tramas', 'inbox']

/**
 * Áreas escondidas do menu neste universo: o que a pessoa escolheu para esse tipo, ou o
 * padrão dele. Num universo de escrita, a mesa só aparece se já tiver uma.
 */
export function hiddenViewsFor(u: Universe, menus: Partial<Record<UniverseKind, View[]>>, legacy: View[] = []): View[] {
  const kind = universeKind(u)
  const saved = menus[kind]
  if (saved) return saved
  if (kind === 'campanha') return CAMPAIGN_HIDDEN
  // O "Só RPG" de antes (que tirava o Livro) não vale para quem escreve.
  const base = legacy.includes('livro') ? [] : legacy.filter((v) => v !== 'rpg')
  return u.groups.length > 0 ? base : [...base, 'rpg']
}

/** A tela em que o universo abre pela primeira vez. */
export const firstView = (u: Universe): View => (universeKind(u) === 'campanha' ? 'rpg' : 'inicio')

/** Telas que são só de escrever: abrir uma delas tira o livro do "setor da mesa". */
export const WRITING_ONLY: View[] = ['inicio', 'escrever', 'livro', 'organizar', 'conhecimento']

/**
 * Num universo de escrita, entrar na mesa é entrar noutro setor: o menu e o clima passam
 * a ser da mesa (também nas fichas e no mapa) até a pessoa voltar para uma tela de escrita.
 */
export function mesaModeAfter(current: boolean, view: View): boolean {
  if (view === 'rpg') return true
  if (WRITING_ONLY.includes(view)) return false
  return current
}
