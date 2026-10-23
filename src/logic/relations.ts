import { formatYear } from '../model/labels'
import type { Relation, Scene, Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'

/** Papéis comuns de quem está por trás de uma relação (texto livre; estes são só sugestões). */
export const VIA_ROLES = ['a mando de', 'com ajuda de', 'por meio de', 'em nome de', 'junto com', 'contra a vontade de', 'por causa de']

/** "Luan envenenou João, a mando de José." */
export function relationSentence(universe: Universe, r: Relation): string {
  const via = r.via.map((v) => `${v.role || 'com'} ${entityName(universe, v.entityId)}`)
  return `${entityName(universe, r.fromId)} ${r.type} ${entityName(universe, r.toId)}${via.length ? `, ${via.join(', ')}` : ''}`
}

/** Quando a relação vale, em poucas palavras. Vazio = sempre. */
export function scopeLabel(universe: Universe, r: Relation): string {
  const s = r.scope
  const suffix = universe.settings.calendarSuffix
  switch (s.kind) {
    case 'geral':
      return ''
    case 'periodo':
      if (s.fromYear !== null && s.toYear !== null) return `de ${formatYear(s.fromYear, suffix)} a ${formatYear(s.toYear, suffix)}`
      if (s.fromYear !== null) return `a partir de ${formatYear(s.fromYear, suffix)}`
      if (s.toYear !== null) return `até ${formatYear(s.toYear, suffix)}`
      return ''
    case 'historia': {
      const names = s.storyIds.map((id) => byId(universe, 'stories', id)?.title).filter(Boolean)
      return names.length ? `em ${names.join(', ')}` : ''
    }
    case 'cenas': {
      const names = s.sceneIds.map((id) => byId(universe, 'scenes', id)?.title).filter(Boolean) as string[]
      if (!names.length) return ''
      return names.length === 1 ? `na cena “${names[0]}”` : `em ${names.length} cenas`
    }
  }
}

/**
 * A relação vale neste ponto da história? Sem cena (`null`), todas valem.
 * Período: compara com o ano da cena (cena sem data não mostra relações de período).
 */
export function activeAt(r: Relation, scene: Scene | null): boolean {
  if (!scene) return true
  const s = r.scope
  switch (s.kind) {
    case 'geral':
      return true
    case 'periodo': {
      const year = scene.date?.year
      if (year === undefined) return false
      return (s.fromYear === null || year >= s.fromYear) && (s.toYear === null || year <= s.toYear)
    }
    case 'historia':
      return scene.storyId !== null && s.storyIds.includes(scene.storyId)
    case 'cenas':
      return s.sceneIds.includes(scene.id)
  }
}

/** Relações em que a ficha aparece como quem está por trás (ou junto). */
export function involvements(universe: Universe, entityId: string): { relation: Relation; role: string }[] {
  return universe.relations.flatMap((r) => r.via.filter((v) => v.entityId === entityId).map((v) => ({ relation: r, role: v.role })))
}

/** Resumo de uma linha: "a mando de José · de 341 DC a 358 DC". */
export function relationDetails(universe: Universe, r: Relation): string {
  const via = r.via.map((v) => `${v.role || 'com'} ${entityName(universe, v.entityId)}`)
  return [...via, scopeLabel(universe, r)].filter(Boolean).join(' · ')
}
