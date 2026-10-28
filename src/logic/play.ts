import { todayKey } from './stats'

/**
 * O lado de jogo da escrita: o desafio do dia, o nível de escritor e as medalhas.
 * Tudo calculado do que já existe (palavras por dia, total escrito); só o que precisa
 * lembrar (desafios aceitos, medalhas já comemoradas) fica neste aparelho.
 */

export const DAILY_PROMPTS: string[] = [
  'Uma personagem encontra uma carta que não era para ela. O que diz a carta, e o que ela faz depois?',
  'Escreva uma cena que começa com uma porta batendo e termina num silêncio.',
  'Duas pessoas esperam o mesmo ônibus (ou carruagem, ou nave). Só uma delas sabe que ele não vai passar.',
  'Descreva um lugar que a sua personagem ama, sem dizer que ela o ama.',
  'Alguém mente para proteger outra pessoa. Mostre a mentira e o custo dela.',
  'Um objeto perdido há anos reaparece. Quem o encontra, e o que ele traz de volta?',
  'Escreva o pior dia de um vilão, do ponto de vista dele.',
  'Uma conversa à mesa em que todos estão educados, e ninguém está tranquilo.',
  'A personagem acorda e uma coisa pequena está diferente no mundo. Só ela percebe.',
  'Escreva uma despedida em que ninguém diz “adeus”.',
  'Comece com a frase: “Ninguém tinha avisado que ia chover.”',
  'Uma criança faz uma pergunta que a personagem não consegue responder.',
  'Escreva uma cena só com diálogo, sem nenhuma descrição. O leitor precisa entender onde estão.',
  'Um segredo é revelado por acidente. Por quem, e diante de quem?',
  'A personagem precisa escolher entre duas coisas que quer muito. Mostre o momento da escolha.',
  'Descreva uma refeição que muda o rumo da história.',
  'Alguém volta para casa depois de muito tempo. A casa mudou; a pessoa mudou mais.',
  'Escreva uma cena num lugar barulhento em que alguém tenta dizer algo importante.',
  'Um desconhecido conhece a personagem pelo nome. Como?',
  'A personagem faz algo corajoso por um motivo nada nobre.',
  'Escreva uma briga por um motivo bobo que esconde um motivo sério.',
  'Comece pelo fim: escreva a última cena de uma história que ainda não existe.',
  'Um animal observa os humanos da sua história. O que ele entende, e o que não entende?',
  'A personagem perde algo que carregava sempre. Mostre o vazio.',
  'Escreva uma cena em que o clima (chuva, calor, neve) é quase uma personagem.',
  'Dois rivais são obrigados a trabalhar juntos por uma hora.',
  'Uma promessa antiga precisa ser cumprida hoje.',
  'A personagem ouve alguém falando dela sem saber que está sendo ouvido.',
  'Escreva sobre a primeira vez que a sua personagem sentiu medo de verdade.',
  'Uma festa em que algo dá muito errado, mas todos fingem que não.',
  'Mostre um ritual do seu mundo: um casamento, um enterro, uma colheita.',
  'A personagem recebe exatamente o que pediu, e isso é um problema.',
  'Escreva uma cena em que a personagem está sozinha, e mesmo assim acontece um conflito.',
  'Alguém conta uma história dentro da história. Quem ouve acredita?',
  'Um mapa, um bilhete ou uma fotografia com um detalhe que não deveria estar ali.',
  'A personagem precisa pedir desculpas e não sabe como.',
  'Escreva uma cena com um cheiro que traz uma lembrança forte.',
  'Uma regra do seu mundo é quebrada pela primeira vez.',
  'Duas personagens falam de uma terceira, que entra no meio da conversa.',
  'Mostre a personagem fazendo o trabalho dela num dia comum, até que algo foge do comum.',
  'Escreva uma perseguição: alguém foge, alguém persegue, e o lugar complica tudo.',
  'A personagem encontra uma versão mais velha (ou mais nova) de si mesma, de algum jeito.',
  'Um presente que ofende quem recebe.',
  'Escreva o momento exato em que alguém perde a confiança em outra pessoa.',
  'Uma cena num lugar apertado: elevador, carroça, cela, cápsula.',
  'A personagem tem dez minutos para convencer alguém de algo.',
  'Descreva uma cidade (ou vila) pela janela de alguém que está indo embora.',
  'Alguém guarda um objeto de quem já morreu. Mostre por quê.',
  'Escreva uma cena engraçada numa situação séria.',
  'A personagem descobre que estava errada sobre algo importante.',
  'Um encontro marcado em que uma das pessoas não aparece.',
  'Escreva uma lista feita pela sua personagem (de compras, de inimigos, de desejos) e o que ela revela.',
  'Uma tempestade obriga desconhecidos a dividir abrigo.',
  'A personagem precisa esconder algo de alguém que a conhece muito bem.',
  'Escreva o primeiro encontro de duas personagens que ainda vão ser importantes uma para a outra.',
  'Uma pequena gentileza tem uma consequência enorme.',
  'Mostre um mercado, uma feira ou um porto cheio, e alguém procurando uma única pessoa ali.',
  'A personagem sonha com algo que acontece no dia seguinte.',
  'Escreva uma cena em que alguém diz a verdade e ninguém acredita.',
  'Termine uma cena com uma pergunta que a personagem não tem coragem de fazer.',
]

/** Palavras na cena do desafio para ele contar como feito. */
export const CHALLENGE_WORDS = 100

const dayIndex = (key: string) => Math.round(Date.parse(`${key}T12:00:00Z`) / 86_400_000)

export function promptOfTheDay(day = todayKey()): string {
  return DAILY_PROMPTS[dayIndex(day) % DAILY_PROMPTS.length]
}

// ─── Desafios aceitos (por dia): qual cena, em qual universo ─────────────

export interface ChallengeRecord {
  /** Desafio aceito como cena num universo. */
  universeId?: string
  sceneId?: string
  /** Ou feito como treino (sprint), sem universo. */
  treinoId?: string
  done?: boolean
}

const CHALLENGES = 'papirus:desafio-do-dia'

export function challenges(): Record<string, ChallengeRecord> {
  try {
    return (JSON.parse(localStorage.getItem(CHALLENGES) ?? '{}') as Record<string, ChallengeRecord>) ?? {}
  } catch {
    return {}
  }
}

export function saveChallenge(day: string, rec: ChallengeRecord) {
  try {
    localStorage.setItem(CHALLENGES, JSON.stringify({ ...challenges(), [day]: rec }))
  } catch {
    // Sem armazenamento: o desafio vale só nesta visita.
  }
}

export const challengesDone = () => Object.values(challenges()).filter((c) => c.done).length

// ─── Nível de escritor ───────────────────────────────────────────────────

export const LEVELS: { words: number; name: string }[] = [
  { words: 0, name: 'Aprendiz' },
  { words: 1_000, name: 'Rabiscador' },
  { words: 5_000, name: 'Escriba' },
  { words: 15_000, name: 'Contista' },
  { words: 40_000, name: 'Cronista' },
  { words: 80_000, name: 'Romancista' },
  { words: 150_000, name: 'Mestre das palavras' },
  { words: 300_000, name: 'Lenda' },
]

export function levelFor(words: number): { n: number; name: string; from: number; to: number | null } {
  let i = 0
  while (i + 1 < LEVELS.length && words >= LEVELS[i + 1].words) i++
  return { n: i + 1, name: LEVELS[i].name, from: LEVELS[i].words, to: LEVELS[i + 1]?.words ?? null }
}

// ─── Medalhas ────────────────────────────────────────────────────────────

export interface PlayStats {
  /** Palavras em todos os universos (sem o exemplo). */
  totalWords: number
  /** Palavras por dia (deste aparelho). */
  history: Record<string, number>
  goal: number
  challengesDone: number
  entities: number
}

export interface Medal {
  id: string
  emoji: string
  name: string
  how: string
  got: (s: PlayStats) => boolean
}

/** Maior sequência de dias seguidos com pelo menos `min` palavras. */
export function bestStreak(history: Record<string, number>, min = 1): number {
  const days = Object.keys(history)
    .filter((d) => (history[d] ?? 0) >= min)
    .map(dayIndex)
    .sort((a, b) => a - b)
  let best = 0
  let run = 0
  let prev = Number.NaN
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

const maxDay = (h: Record<string, number>) => Math.max(0, ...Object.values(h))

export const MEDALS: Medal[] = [
  { id: 'primeira-pagina', emoji: '✍️', name: 'Primeira página', how: 'Escrever 100 palavras.', got: (s) => s.totalWords >= 100 },
  { id: 'meta-batida', emoji: '🎯', name: 'Na mosca', how: 'Bater a meta do dia pela primeira vez.', got: (s) => s.goal > 0 && maxDay(s.history) >= s.goal },
  { id: 'mil-num-dia', emoji: '⚡', name: 'Mil num dia', how: 'Escrever 1.000 palavras num mesmo dia.', got: (s) => maxDay(s.history) >= 1000 },
  { id: 'tres-dias', emoji: '🔥', name: 'Pegando fogo', how: 'Escrever 3 dias seguidos.', got: (s) => bestStreak(s.history) >= 3 },
  { id: 'sete-dias', emoji: '📅', name: 'Uma semana inteira', how: 'Escrever 7 dias seguidos.', got: (s) => bestStreak(s.history) >= 7 },
  { id: 'trinta-dias', emoji: '🏆', name: 'Hábito de escritor', how: 'Escrever 30 dias seguidos.', got: (s) => bestStreak(s.history) >= 30 },
  { id: 'dez-mil', emoji: '📜', name: 'Dez mil palavras', how: 'Somar 10.000 palavras.', got: (s) => s.totalWords >= 10_000 },
  { id: 'romance', emoji: '📚', name: 'Tamanho de romance', how: 'Somar 50.000 palavras (o tamanho de um romance curto).', got: (s) => s.totalWords >= 50_000 },
  { id: 'desafio', emoji: '🎲', name: 'Topei o desafio', how: 'Completar um desafio do dia.', got: (s) => s.challengesDone >= 1 },
  { id: 'dez-desafios', emoji: '🧩', name: 'Dez desafios', how: 'Completar 10 desafios do dia.', got: (s) => s.challengesDone >= 10 },
  { id: 'mundo-vivo', emoji: '🌍', name: 'Mundo vivo', how: 'Ter 20 fichas num universo.', got: (s) => s.entities >= 20 },
]

// Medalhas já comemoradas (para comemorar só as novas).
const SEEN = 'papirus:medalhas-vistas'

/** As já comemoradas; `null` na primeira vez (aí só registra, sem enxurrada de avisos). */
export function seenMedals(): string[] | null {
  try {
    const raw = localStorage.getItem(SEEN)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return []
  }
}

export function markMedalsSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN, JSON.stringify(ids))
  } catch {
    // Sem armazenamento: pode comemorar de novo.
  }
}
