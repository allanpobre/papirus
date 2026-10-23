import { formatYear } from '../model/labels'
import type { ContinuityAnswer, Universe } from '../model/schema'
import { byId, entityName, manuscriptOrder } from '../model/universe'
import { fold } from './text'

export type QuestionType = 'presenca-dupla' | 'apos-fim' | 'antes-inicio' | 'fatos-divergentes'

export interface Question {
  /** Assinatura estável: a mesma pergunta mantém a mesma resposta. */
  key: string
  type: QuestionType
  /** Cena onde a pergunta aparece (se houver). */
  sceneId: string | null
  sceneIds: string[]
  entityId: string | null
  factIds: string[]
  text: string
  answer?: ContinuityAnswer
}

export type QuestionToggles = Partial<Record<QuestionType, boolean>>

/**
 * Perguntas de continuidade a partir do que o autor registrou. São perguntas,
 * não erros: mistérios, magia e contradições propositais são permitidos.
 * Tipos desligados nas configurações não são gerados.
 */
export function continuityQuestions(universe: Universe, toggles: QuestionToggles = {}): Question[] {
  const on = (t: QuestionType) => toggles[t] !== false
  const suffix = universe.settings.calendarSuffix
  const answers = new Map(universe.continuity.map((a) => [a.key, a]))
  const out: Question[] = []
  const scenes = manuscriptOrder(universe)

  if (on('presenca-dupla')) {
    const dated = scenes.filter((s) => s.date && s.date.day !== null && s.placeId)
    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        const a = dated[i]
        const b = dated[j]
        if (a.date!.year !== b.date!.year || a.date!.day !== b.date!.day || a.placeId === b.placeId) continue
        for (const id of a.presentIds.filter((x) => b.presentIds.includes(x))) {
          out.push({
            key: `presenca-dupla:${[a.id, b.id].sort().join('+')}:${id}`,
            type: 'presenca-dupla',
            sceneId: b.id,
            sceneIds: [a.id, b.id],
            entityId: id,
            factIds: [],
            text: `${entityName(universe, id)} está em ${entityName(universe, a.placeId)} em “${a.title}” e em ${entityName(universe, b.placeId)} em “${b.title}”, no mesmo dia. Viajou, ou é outra pessoa?`,
          })
        }
      }
    }
  }

  for (const scene of scenes) {
    if (!scene.date) continue
    const year = scene.date.year
    const involved = new Set([...scene.presentIds, scene.povId, scene.placeId].filter(Boolean) as string[])
    for (const id of involved) {
      const e = byId(universe, 'entities', id)
      if (!e) continue
      const isPlace = id === scene.placeId
      if (on('apos-fim') && e.endYear !== null && year > e.endYear) {
        out.push({
          key: `apos-fim:${scene.id}:${id}`,
          type: 'apos-fim',
          sceneId: scene.id,
          sceneIds: [scene.id],
          entityId: id,
          factIds: [],
          text: isPlace
            ? `“${scene.title}” se passa em ${e.name} em ${formatYear(year, suffix)}, mas a ficha diz que o lugar deixou de existir em ${formatYear(e.endYear, suffix)}. Ruínas, memória ou engano?`
            : `${e.name} aparece em “${scene.title}” (${formatYear(year, suffix)}), mas a ficha registra o fim em ${formatYear(e.endYear, suffix)}. Flashback, fantasma, ou a data mudou?`,
        })
      }
      if (on('antes-inicio') && e.startYear !== null && year < e.startYear) {
        out.push({
          key: `antes-inicio:${scene.id}:${id}`,
          type: 'antes-inicio',
          sceneId: scene.id,
          sceneIds: [scene.id],
          entityId: id,
          factIds: [],
          text: `${e.name} aparece em “${scene.title}” (${formatYear(year, suffix)}), antes do início registrado na ficha (${formatYear(e.startYear, suffix)}). É intencional?`,
        })
      }
    }
  }

  if (on('fatos-divergentes')) {
    const groups = new Map<string, typeof universe.facts>()
    for (const f of universe.facts) {
      if (!f.subjectId || !f.predicate.trim()) continue
      const k = `${f.subjectId}|${fold(f.predicate.trim())}`
      groups.set(k, [...(groups.get(k) ?? []), f])
    }
    for (const facts of groups.values()) {
      const established = facts.filter((f) => f.canon === 'estabelecido')
      const values = new Set(established.map((f) => f.objectId ?? fold(f.value.trim())))
      if (values.size < 2) continue
      const ids = established.map((f) => f.id).sort()
      const f = established[0]
      out.push({
        key: `fatos-divergentes:${ids.join('+')}`,
        type: 'fatos-divergentes',
        sceneId: null,
        sceneIds: established.map((x) => x.sourceSceneId).filter(Boolean) as string[],
        entityId: f.subjectId,
        factIds: ids,
        text: `Há ${established.length} fatos estabelecidos diferentes para “${entityName(universe, f.subjectId)} ${f.predicate}”. Um deles é rumor, mentira ou mudou com o tempo?`,
      })
    }
  }

  return out.map((q) => ({ ...q, answer: answers.get(q.key) }))
}

/** Perguntas ainda em aberto (sem resposta ou adiadas). */
export const isOpen = (q: Question) => !q.answer || q.answer.answer === 'depois'
