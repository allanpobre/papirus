import { fold } from './text'
import type { Entity } from '../model/schema'

/*
 * Perguntas para começar uma ficha vazia, como os modelos do World Anvil: três ou quatro
 * por tipo, que valem uma linha cada. Nas de magia e de artefato, primeiro o custo e o
 * limite (a Segunda Lei de Sanderson: o que a magia não faz interessa mais do que o que ela faz).
 * A resposta vira um campo da ficha; o nome do campo bate com os modelos de universo
 * (Objetivo, Medo, Segredo…), para não repetir o que já existe.
 */

export interface KindQuestion {
  /** O nome do campo em que a resposta fica. */
  key: string
  ask: string
  example: string
}

const KIND_QUESTIONS: Record<string, KindQuestion[]> = {
  personagem: [
    { key: 'Objetivo', ask: 'O que quer, mais que tudo?', example: 'Sair da ilha antes do inverno' },
    { key: 'Medo', ask: 'Do que tem medo?', example: 'De ficar igual ao pai' },
    { key: 'Segredo', ask: 'O que esconde?', example: 'Nunca aprendeu a ler' },
    { key: 'Como fala', ask: 'Como fala? Uma mania, uma palavra.', example: 'Responde pergunta com pergunta' },
  ],
  lugar: [
    { key: 'Por dentro', ask: 'Como é por dentro? Um cheiro, um som.', example: 'Cheira a peixe frito e corda molhada' },
    { key: 'Quem governa', ask: 'Quem manda aqui?', example: 'Rhea, que não pergunta de onde vem o dinheiro' },
    { key: 'Perigos', ask: 'O que é perigoso aqui?', example: 'A maré, que sobe sem aviso' },
    { key: 'O que mudou', ask: 'O que mudou aqui com o tempo?', example: 'Depois da guerra, ninguém mais canta' },
  ],
  faccao: [
    { key: 'Objetivo', ask: 'O que querem?', example: 'O trono vazio' },
    { key: 'Inimigos', ask: 'Contra quem estão?', example: 'A guarda do porto' },
    { key: 'Como entrar', ask: 'Como alguém entra (ou sai)?', example: 'Só por convite, e ninguém sai vivo' },
    { key: 'O que escondem', ask: 'O que escondem de quem é de fora?', example: 'O líder morreu faz um ano' },
  ],
  magia: [
    { key: 'Custo', ask: 'Quanto custa usar? O que se perde?', example: 'Um dia de memória a cada feitiço' },
    { key: 'Limites', ask: 'O que ela não consegue fazer?', example: 'Não cura, não traz ninguém de volta' },
    { key: 'Quem pode usar', ask: 'Quem pode usar, e quem nunca vai poder?', example: 'Só quem nasceu em noite sem lua' },
    { key: 'Como se vê', ask: 'Como é quando alguém usa? O que os outros notam?', example: 'O ar esfria e as velas apagam' },
  ],
  artefato: [
    { key: 'Custo', ask: 'O que custa usar (ou carregar)?', example: 'Quem segura não dorme' },
    { key: 'Limites', ask: 'O que ele não faz?', example: 'Não corta o que está vivo' },
    { key: 'Quem quer', ask: 'Quem quer este objeto?', example: 'A igreja inteira' },
    { key: 'Origem', ask: 'De onde veio?', example: 'Do Vale das Brumas, antes da Queda' },
  ],
  religiao: [
    { key: 'Promete', ask: 'O que ela promete a quem acredita?', example: 'Que os mortos voltam com a maré' },
    { key: 'Proíbe', ask: 'O que ela proíbe?', example: 'Enterrar os mortos em terra' },
    { key: 'Ritual', ask: 'Um ritual do dia a dia?', example: 'Sal na porta toda manhã' },
    { key: 'Quem duvida', ask: 'Quem não acredita, e o que acontece com essa pessoa?', example: 'Perde o direito de pescar' },
  ],
  cultura: [
    { key: 'Valoriza', ask: 'O que esse povo mais valoriza?', example: 'Palavra dada' },
    { key: 'Vergonha', ask: 'O que é vergonha para eles?', example: 'Chorar em público' },
    { key: 'Costume', ask: 'Uma festa ou um costume?', example: 'Na primeira chuva, todos saem descalços' },
    { key: 'Com os de fora', ask: 'Como tratam quem é de fora?', example: 'Bem, por três dias' },
  ],
  especie: [
    { key: 'Diferente', ask: 'O que a faz diferente das outras?', example: 'Enxerga no escuro, não vê vermelho' },
    { key: 'Precisa', ask: 'Do que precisa para viver?', example: 'Água salgada todo dia' },
    { key: 'Perigos', ask: 'É perigosa? Para quem?', example: 'Só para quem mente perto dela' },
  ],
  reino: [
    { key: 'Regras', ask: 'Que regra vale lá e não vale aqui?', example: 'O tempo anda para trás' },
    { key: 'Como chegar', ask: 'Como se chega (e se sai)?', example: 'Por um espelho, uma vez por ano' },
    { key: 'Quem vive', ask: 'Quem vive lá?', example: 'Os que se afogaram' },
  ],
  conceito: [
    { key: 'Na história', ask: 'Onde isso aparece na história?', example: 'Na decisão final da Mira' },
    { key: 'Quem entende', ask: 'Quem entende isso de verdade?', example: 'Só o velho do farol' },
  ],
}

const ANY_KIND: KindQuestion[] = [
  { key: 'O que é', ask: 'O que é, em uma linha?', example: 'Um apito que só cachorros mortos ouvem' },
  { key: 'Na história', ask: 'Por que importa para a história?', example: 'É por ele que a Mira volta' },
]

export const questionsFor = (kind: string): KindQuestion[] => KIND_QUESTIONS[kind] ?? ANY_KIND

/** Vazia: sem resumo, sem descrição e sem nenhum campo preenchido (campos de modelo vazios não contam). */
export const isBlank = (e: Pick<Entity, 'summary' | 'description' | 'fields'>): boolean => !e.summary.trim() && !e.description.trim() && e.fields.every((f) => !f.value.trim())

const sameKey = (a: string, b: string) => fold(a.trim()) === fold(b.trim())

/** O campo que responde a pergunta, se já existir (de um modelo, por exemplo). */
export const answerOf = (fields: Entity['fields'], key: string): string => fields.find((f) => sameKey(f.key, key))?.value ?? ''

/** Responde uma pergunta: preenche o campo de mesmo nome, ou cria um no fim. */
export function answer(fields: Entity['fields'], key: string, value: string): Entity['fields'] {
  const at = fields.findIndex((f) => sameKey(f.key, key))
  if (at >= 0) return fields.map((f, i) => (i === at ? { ...f, value } : f))
  return [...fields, { key, value }]
}

/** Os campos que as perguntas já mostram (para não aparecerem duas vezes na mesma tela). */
export const askedKey = (kind: string, key: string): boolean => questionsFor(kind).some((q) => sameKey(q.key, key))
