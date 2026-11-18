import { z } from 'zod'
import { DiceError } from '../logic/dice'
import { MODIFIER_RULES, RESOLUTION_MODES, type GameSystem } from '../model/schema'
import { newId } from '../model/universe'
import { expandFormula, resolveRoll } from './rolls'
import { draftSheet } from './sheets'
import { type SystemDraft } from './systems'

/**
 * Um sistema de RPG como arquivo (.json): para levar de uma campanha ou de um universo para outro. Tem só a estrutura
 * (atributos, perícias, fórmulas, condições…), nunca fichas, grupos ou sessões. Ao importar, tudo ganha ids novos e o que
 * não der para trazer vem num aviso, em vez de derrubar a importação.
 */
export const SYSTEM_FILE_FORMAT = 'papirus-sistema'
export const SYSTEM_FILE_VERSION = 1
/** Limite do arquivo (em bytes) e das listas: um sistema grande de verdade é bem menor que isso. */
export const SYSTEM_FILE_MAX = 500_000
const MAX = { attributes: 40, resources: 24, skills: 300, conditions: 80, fields: 40 }

export interface SystemFile {
  formato: typeof SYSTEM_FILE_FORMAT
  versao: number
  sistema: SystemDraft
}

/** O sistema pronto para guardar em arquivo (sem id nem datas: ele ganha os seus ao entrar em outro lugar). */
export function exportSystem(s: GameSystem): string {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = s
  void _id
  void _c
  void _u
  const file: SystemFile = { formato: SYSTEM_FILE_FORMAT, versao: SYSTEM_FILE_VERSION, sistema: structuredClone(rest) }
  return JSON.stringify(file, null, 2)
}

const text = (max: number) => z.string().transform((v) => v.slice(0, max))
const attributeShape = z.object({ id: z.string(), abbr: text(8), name: text(60), default: z.number(), min: z.number(), max: z.number() })
const resourceShape = z.object({ id: z.string(), abbr: text(8), name: text(60), default: z.number() })
const skillShape = z.object({ id: z.string(), name: text(80), attributeId: z.string().nullable().optional() })

/** Os itens de uma lista que passam no formato; os outros viram aviso ("Atributo 3 ficou de fora"). */
function keep<T>(list: unknown, shape: z.ZodType<T>, max: number, noun: string, warnings: string[]): T[] {
  if (list === undefined) return []
  if (!Array.isArray(list)) {
    warnings.push(`${noun}: o arquivo não traz uma lista (ficou vazio).`)
    return []
  }
  const out: T[] = []
  list.forEach((item, i) => {
    if (out.length >= max) return
    const r = shape.safeParse(item)
    if (r.success) out.push(r.data)
    else warnings.push(`${noun} ${i + 1} ficou de fora: faltava ou estava errado algum campo.`)
  })
  if (list.length > max) warnings.push(`${noun}: só os primeiros ${max} entraram (o arquivo tinha ${list.length}).`)
  return out
}

const strings = (list: unknown, max: number, noun: string, warnings: string[]): string[] => {
  if (list === undefined) return []
  if (!Array.isArray(list)) {
    warnings.push(`${noun}: o arquivo não traz uma lista (ficou vazio).`)
    return []
  }
  const out = [...new Set(list.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 60)))]
  if (out.length > max) warnings.push(`${noun}: só os primeiros ${max} entraram.`)
  return out.slice(0, max)
}

export interface SystemRead {
  /** O sistema para pôr no universo (sem id); nulo se o arquivo não é um sistema. */
  system: SystemDraft | null
  /** O que não deu para trazer (ou foi mudado), em frases para a pessoa. */
  warnings: string[]
  /** Por que o arquivo todo foi recusado. */
  error?: string
}

/** Uma fórmula que não roda neste sistema avisa (mas entra: a pessoa conserta no editor). */
function checkFormula(label: string, formula: string, s: GameSystem, warnings: string[]) {
  if (!formula.trim()) {
    warnings.push(`A fórmula de ${label} veio vazia.`)
    return
  }
  try {
    const sample = { ...draftSheet('Teste', s), id: 'teste', createdAt: '', updatedAt: '' }
    resolveRoll(s, label, expandFormula(formula, { system: s, sheet: sample, attributeId: s.attributes[0]?.id ?? null, skillValue: s.resolution === 'abaixo' ? 50 : 0 }), s.resolution === 'abaixo' ? 50 : undefined)
  } catch (err) {
    warnings.push(`A fórmula de ${label} (“${formula}”) não funciona neste sistema${err instanceof DiceError ? `: ${err.message.replace(/\.$/, '')}` : ''}. Acerte no editor.`)
  }
}

/** Lê o arquivo de um sistema: confere o formato, traz o que dá e avisa do que não deu. Nunca lança. */
export function readSystemFile(raw: string): SystemRead {
  if (raw.length > SYSTEM_FILE_MAX) return { system: null, warnings: [], error: 'O arquivo é grande demais para ser um sistema.' }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { system: null, warnings: [], error: 'Isto não é um arquivo de sistema (não consegui ler o conteúdo).' }
  }
  const file = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  if (!file || file.formato !== SYSTEM_FILE_FORMAT || !file.sistema || typeof file.sistema !== 'object') {
    return { system: null, warnings: [], error: 'Isto não parece um sistema do Papirus. Use um arquivo que saiu de “Exportar sistema”.' }
  }
  const warnings: string[] = []
  if (typeof file.versao === 'number' && file.versao > SYSTEM_FILE_VERSION) warnings.push('O arquivo é de uma versão mais nova do Papirus: trouxe o que deu, e pode faltar alguma coisa.')
  const o = file.sistema as Record<string, unknown>

  // Os ids do arquivo viram ids novos (aqui dentro e nas perícias, que apontam para o atributo).
  const attrs = keep(o.attributes, attributeShape, MAX.attributes, 'Atributo', warnings)
  const idOf = new Map(attrs.map((a) => [a.id, newId()]))
  const attributes = attrs.map((a) => ({ id: idOf.get(a.id)!, abbr: a.abbr, name: a.name, default: a.default, min: a.min, max: a.max }))
  const resources = keep(o.resources, resourceShape, MAX.resources, 'Recurso', warnings).map((r) => ({ id: newId(), abbr: r.abbr, name: r.name, default: r.default }))
  let orphan = 0
  const skills = keep(o.skills, skillShape, MAX.skills, 'Perícia', warnings).map((k) => {
    const attributeId = k.attributeId ? (idOf.get(k.attributeId) ?? null) : null
    if (k.attributeId && !attributeId) orphan++
    return { id: newId(), name: k.name, attributeId }
  })
  if (orphan) warnings.push(`${orphan} ${orphan === 1 ? 'perícia apontava' : 'perícias apontavam'} para um atributo que não veio: ficou sem atributo.`)

  const rule = MODIFIER_RULES.find((x) => x === o.modifierRule)
  if (!rule) warnings.push('A regra de modificador não foi reconhecida: ficou “sem modificador”.')
  const resolution = RESOLUTION_MODES.find((x) => x === o.resolution)
  if (!resolution) warnings.push('O jeito de ler a rolagem não foi reconhecido: ficou “soma o total”.')
  const f = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : '')
  const features = o.features && typeof o.features === 'object' ? (o.features as Record<string, unknown>) : {}
  const flag = (k: string) => (typeof features[k] === 'boolean' ? (features[k] as boolean) : true)
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 80) : 'Sistema importado'
  if (name === 'Sistema importado' && !(typeof o.name === 'string' && o.name.trim())) warnings.push('O arquivo não tinha o nome do sistema: chamei de “Sistema importado”.')

  const system: SystemDraft = {
    name,
    template: typeof o.template === 'string' ? o.template : null,
    attributes,
    modifierRule: rule ?? 'nenhum',
    resources,
    skills,
    skillFormula: f(o.skillFormula),
    attributeFormula: f(o.attributeFormula),
    initiativeFormula: f(o.initiativeFormula),
    resolution: resolution ?? 'total',
    successTarget: Number.isInteger(o.successTarget) ? (o.successTarget as number) : 6,
    zeroDiceRule: o.zeroDiceRule === true,
    conditions: strings(o.conditions, MAX.conditions, 'Condições', warnings),
    fields: strings(o.fields, MAX.fields, 'Campos da ficha', warnings),
    features: { initiative: flag('initiative'), resources: flag('resources'), conditions: flag('conditions'), rollLog: flag('rollLog') },
  }
  // Conferir as fórmulas no sistema já montado.
  const probe: GameSystem = { ...system, id: 'importado', createdAt: '', updatedAt: '' }
  checkFormula('perícia', system.skillFormula, probe, warnings)
  checkFormula('atributo', system.attributeFormula, probe, warnings)
  checkFormula('iniciativa', system.initiativeFormula, probe, warnings)
  return { system, warnings }
}

/** Um nome que não repete os dos sistemas que já existem: "D&D", "D&D (2)", "D&D (3)"… */
export function freeSystemName(name: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  if (!taken.has(name.trim().toLowerCase())) return name
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
