/**
 * Que tipo de ficha um nome novo parece ser, pelo texto em volta. Só uma sugestão (dá para trocar):
 * "na cidade de X", "chegou a X", "em X" apontam para lugar; "X disse", "disse X", "Sr. X", "X olhou" apontam para personagem.
 * Sem pista, ou com pistas empatadas, fica personagem (o que a Revisão já sugeria).
 */
export type KindGuess = 'personagem' | 'lugar'

const PLACE_NOUN = [
  'cidade', 'cidadela', 'vila', 'vilarejo', 'aldeia', 'povoado', 'reino', 'país', 'pais', 'terra', 'terras', 'floresta', 'bosque', 'montanha', 'montanhas', 'monte',
  'serra', 'rio', 'lago', 'ilha', 'castelo', 'palácio', 'palacio', 'vale', 'deserto', 'campo', 'campos', 'pradaria', 'pradarias', 'planície', 'planicie', 'região',
  'regiao', 'província', 'provincia', 'estado', 'condado', 'ducado', 'império', 'imperio', 'porto', 'torre', 'templo', 'caverna', 'mar', 'oceano', 'estrada',
  'ponte', 'capital', 'distrito', 'fazenda', 'reinado', 'continente', 'península', 'peninsula', 'costa', 'praia', 'pântano', 'pantano',
].join('|')
const MOVE_VERB = [
  'chegou', 'chegaram', 'chegamos', 'chego', 'vai', 'vão', 'foi', 'foram', 'voltou', 'voltaram', 'viajou', 'viajaram', 'partiu', 'partiram', 'seguiu', 'seguiram',
  'retornou', 'fugiu', 'fugiram', 'desceu', 'subiu', 'entrou', 'saiu', 'levou', 'levaram', 'mudou-se', 'mudaram-se', 'dirigiu-se', 'caminhou', 'andou',
].join('|')
const STAY_VERB = ['mora', 'morava', 'moram', 'moravam', 'vive', 'vivia', 'vivem', 'viviam', 'nasceu', 'nasceram', 'cresceu', 'estava', 'estavam', 'ficou', 'ficaram', 'fica', 'ficam', 'fica-se'].join('|')
const TALK_VERB = [
  'disse', 'respondeu', 'perguntou', 'gritou', 'sussurrou', 'murmurou', 'falou', 'exclamou', 'replicou', 'acrescentou', 'explicou', 'pediu', 'chamou', 'conheceu', 'encontrou',
  'abraçou', 'beijou', 'ajudou', 'salvou', 'matou', 'amava', 'odiava', 'avisou', 'ouviu', 'viu',
].join('|')
const ACT_VERB = [
  'disse', 'respondeu', 'perguntou', 'gritou', 'sussurrou', 'murmurou', 'falou', 'exclamou', 'replicou', 'acrescentou', 'explicou', 'pediu', 'sorriu', 'riu', 'chorou',
  'olhou', 'pegou', 'abraçou', 'levantou-se', 'sentou-se', 'acordou', 'dormiu', 'pensou', 'decidiu', 'quis', 'sabia', 'achou', 'sentiu', 'ouviu', 'viu', 'conhecia',
  'ajudou', 'salvou', 'latiu', 'pulou', 'correu', 'andou', 'caminhou', 'abriu', 'fechou', 'tomou', 'entrou', 'saiu', 'voltou', 'chegou', 'balançou', 'sacudiu',
  'virou', 'seguiu', 'chamou', 'trouxe', 'sorria', 'dizia', 'olhava', 'sabe', 'sabia',
].join('|')
const HONORIFIC = ['sr', 'sra', 'srta', 'dr', 'dra', 'dom', 'dona', 'seu', 'tio', 'tia', 'primo', 'prima', 'irmão', 'irmã', 'capitão', 'general', 'rei', 'rainha', 'príncipe', 'princesa', 'senhor', 'senhora', 'mestre', 'lorde', 'lady', 'sir', 'padre', 'doutor', 'doutora', 'professor', 'professora', 'bruxo', 'bruxa', 'mago', 'maga', 'guarda', 'soldado'].join('|')

const re = (src: string, flags = 'iu') => new RegExp(src, flags)
const PLACE_STRONG = [
  re(`(?:^|[^\\p{L}])(?:${PLACE_NOUN})\\s+(?:de|do|da|dos|das|d')\\s+$`),
  re(`(?:^|[^\\p{L}])(?:${MOVE_VERB})\\s+(?:a|à|ao|para|pra|em|na|no|até|de|do|da)\\s+$`),
  re(`(?:^|[^\\p{L}])(?:${STAY_VERB})\\s+(?:em|na|no)\\s+$`),
]
const PLACE_WEAK = [re('(?:^|[^\\p{L}])(?:em|na|no|nas|nos|à|ao|aos|pela|pelo|pelas|pelos|até)\\s+$')]
const PERSON_STRONG_BEFORE = [
  re(`(?:^|[^\\p{L}])(?:${TALK_VERB})\\s+$`),
  re(`(?:^|[^\\p{L}])(?:${HONORIFIC})\\.?\\s+$`),
  re('(?:^|[^\\p{L}])(?:pensou|pensava|falou|falava|sonhou|sonhava|lembrou|lembrava|gostava|gostou|cuidou|cuidava|confiou|confiava|acreditou|riu|ria)\\s+(?:de|em|com|sobre)\\s+$'),
]
const PERSON_STRONG_AFTER = [re(`^\\s*(?:,\\s*)?(?:${ACT_VERB})(?:[^\\p{L}]|$)`), re('^\\s*(?:,\\s*)?(?:que|e)\\s+(?:ele|ela)\\b')]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** As pistas a favor de lugar e de personagem em todas as vezes que o nome aparece nos textos. */
export function kindScore(name: string, texts: string[]): { place: number; person: number } {
  let place = 0
  let person = 0
  const here = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'gu')
  for (const text of texts) {
    for (const m of text.matchAll(here)) {
      const before = text.slice(Math.max(0, m.index - 48), m.index)
      const after = text.slice(m.index + name.length, m.index + name.length + 48)
      if (PERSON_STRONG_BEFORE.some((r) => r.test(before))) person += 3
      else if (PLACE_STRONG.some((r) => r.test(before))) place += 3
      else if (PLACE_WEAK.some((r) => r.test(before))) place += 1
      if (PERSON_STRONG_AFTER.some((r) => r.test(after))) person += 3
    }
  }
  return { place, person }
}

/** O tipo sugerido para um nome novo, olhando os textos em que ele aparece. */
export function suggestKind(name: string, texts: string[]): KindGuess {
  const { place, person } = kindScore(name, texts)
  return place > person ? 'lugar' : 'personagem'
}
