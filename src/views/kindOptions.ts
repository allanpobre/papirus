import { KIND_LABEL } from '../model/labels'
import { ENTITY_KINDS } from '../model/schema'
import { useWorkspace } from '../state/workspace'

/** Os tipos para escolher ao criar: os comuns e os próprios deste universo ("Navio", "Idioma"…). */
export function useKindOptions() {
  const { universe } = useWorkspace()
  const own = [...new Set(universe.entities.map((e) => e.kind))].filter((k) => !(ENTITY_KINDS as readonly string[]).includes(k)).sort((a, b) => a.localeCompare(b, 'pt'))
  return [...ENTITY_KINDS.map((k) => ({ value: k as string, label: KIND_LABEL[k] })), ...own.map((k) => ({ value: k, label: k }))]
}

/** Os nomes colados, um por linha, sem repetir e sem linhas vazias. */
export function namesFromText(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => {
      const k = l.toLocaleLowerCase('pt-BR')
      if (!l || seen.has(k)) return false
      seen.add(k)
      return true
    })
}
