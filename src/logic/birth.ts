import type { Entity, Universe } from '../model/schema'
import { questionsFor, type KindQuestion } from './kindQuestions'
import { fillEntry } from './worldRolls'

/*
 * O nascimento de uma ficha: as perguntas viram cartas, e o dado sorteia uma resposta a partir do próprio mundo
 * (lugares, grupos e pessoas que já existem). No fim, a ficha ganha as primeiras ligações com um toque.
 */

/** Faíscas por campo: frases com {lugar}, {personagem}, {grupo}, {objeto} tiradas do mundo. */
const SPARKS: Record<string, string[]> = {
  Objetivo: [
    'Descobrir quem destruiu {lugar}',
    'Entrar para {grupo} sem que saibam de onde veio',
    'Pagar a dívida que tem com {personagem}',
    'Sair de {lugar} antes do inverno',
    'Ser lembrado pelo nome, não pelo que fez',
    'Tomar o lugar de {personagem}',
  ],
  Medo: ['De voltar para {lugar}', 'De que {personagem} descubra a verdade', 'De água funda', 'De ficar igual ao pai', 'De ser esquecido', 'Do silêncio de {grupo}'],
  Segredo: [
    'Trabalha em segredo para {grupo}',
    'Já esteve em {lugar} e jura que não',
    'Guarda {objeto} que não é seu',
    'É parente de {personagem}',
    'Nunca aprendeu a ler',
    'Foi quem traiu {grupo}',
  ],
  'Como fala': [
    'Responde pergunta com pergunta',
    'Chama todo mundo pelo sobrenome',
    'Fala baixo quando mente',
    'Cita provérbios de {lugar}',
    'Termina as frases com “não é?”',
    'Nunca diz o nome de {personagem}',
  ],
  'Por dentro': ['Cheira a {objeto} e fumaça', 'Um sino toca sozinho à meia-noite', 'Paredes cobertas de nomes riscados', 'Silêncio demais para o tamanho'],
  'Quem governa': ['{personagem}, que não pergunta de onde vem o dinheiro', '{grupo}, de longe', 'Ninguém, desde a última guerra', 'Quem tiver a chave de {lugar}'],
  Perigos: ['A maré, que sobe sem aviso', 'Os homens de {grupo}', 'Pontes que caem com chuva', 'Quem pergunta demais some'],
  'O que mudou': ['Depois da guerra, ninguém mais canta', 'Desde que {personagem} chegou, as portas ficam trancadas', '{grupo} foi embora e levou o ouro'],
  Inimigos: ['{grupo}', '{personagem} e quem anda com ele', 'Os de {lugar}', 'Ninguém sabe; por isso têm medo'],
  'Como entrar': ['Só por convite, e ninguém sai vivo', 'Trazendo {objeto} de {lugar}', 'Matando por eles uma vez', 'Nascendo dentro'],
  'O que escondem': ['O líder morreu faz um ano', 'Devem tudo a {grupo}', 'Nasceram em {lugar}', 'Guardam {objeto} roubado'],
}

/** Uma faísca para a pergunta: do mundo quando dá; senão, o exemplo da pergunta. Nunca usa a própria ficha. */
export function sparkFor(q: KindQuestion, u: Universe, self: string, random = Math.random): string {
  const list = SPARKS[q.key]
  if (!list?.length) return q.example
  const others = { ...u, entities: u.entities.filter((e) => e.id !== self) }
  return fillEntry(list[Math.floor(random() * list.length)], others, random).text
}

/** As perguntas do nascimento (as do tipo, como no "Para começar"). */
export const birthQuestions = (kind: string): KindQuestion[] => questionsFor(kind)

/** Como esta ficha pode se ligar a outra, pelo tipo das duas: as frases mais comuns, em ordem. */
export function tieTypes(from: string, to: string): string[] {
  if (to === 'lugar') return from === 'personagem' ? ['nasceu em', 'mora em', 'fugiu de'] : ['fica em', 'nasceu em']
  if (to === 'reino') return ['fica em', 'serve a', 'nasceu em']
  if (['faccao', 'religiao', 'cultura', 'especie'].includes(to)) return from === 'personagem' ? ['faz parte de', 'serve a', 'odeia'] : ['ligado a', 'contra']
  if (to === 'personagem') return from === 'personagem' ? ['parente de', 'confia em', 'rival de', 'deve a', 'ama'] : ['pertence a', 'protege', 'persegue']
  return ['ligado a']
}

/**
 * Fichas para ligar no nascimento: primeiro as mais citadas no texto e as que já têm ligações, sem segredos
 * e sem a própria ficha; de tipos variados (lugar, grupo, gente), no máximo `max`.
 */
export function tieSuggestions(u: Universe, self: Entity, max = 8): Entity[] {
  const weight = new Map<string, number>()
  for (const r of u.relations) for (const id of [r.fromId, r.toId]) weight.set(id, (weight.get(id) ?? 0) + 1)
  const pool = u.entities.filter((e) => e.id !== self.id && e.canon !== 'secreto' && e.name.trim())
  // Quem aparece em mais cenas pesa mais (pelo nome no texto).
  for (const e of pool) weight.set(e.id, (weight.get(e.id) ?? 0) + 2 * u.scenes.filter((s) => s.text.includes(e.name)).length)
  const sorted = [...pool].sort((a, b) => (weight.get(b.id) ?? 0) - (weight.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  // Alterna os tipos para não sugerir só personagens.
  const byKind = new Map<string, Entity[]>()
  for (const e of sorted) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e])
  const out: Entity[] = []
  while (out.length < max && [...byKind.values()].some((l) => l.length)) for (const l of byKind.values()) if (l.length && out.length < max) out.push(l.shift()!)
  return out
}
