import { fold } from './text'

/**
 * Gerador de nomes no estilo dos que já existem: aprende quais letras costumam vir depois
 * de quais (cadeia de Markov de ordem 2) e monta nomes novos com esse "sotaque".
 * Com poucos nomes no universo, usa uma lista de partida do gênero.
 */
const SEEDS = {
  pessoas: ['Ana', 'Beatriz', 'Carlos', 'Daniel', 'Eduarda', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Júlia', 'Lucas', 'Mariana', 'Nicolau', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago', 'Valéria', 'Vicente', 'Laura', 'Bruno', 'Clara', 'Heitor', 'Isadora', 'Joaquim', 'Lívia', 'Mateus', 'Olívia', 'Teresa'],
  fantasia: ['Aldric', 'Belisa', 'Caelan', 'Doran', 'Elowen', 'Fenris', 'Galen', 'Isolde', 'Kaelor', 'Lyra', 'Maelis', 'Neris', 'Orin', 'Seraphine', 'Taryn', 'Thalor', 'Vaelor', 'Ysolde', 'Zarek', 'Aurelia', 'Brannoc', 'Cyrene', 'Eldrin', 'Merrow', 'Ilyan', 'Sorell', 'Varra', 'Eryndor'],
  ficcao: ['Axel', 'Nova', 'Kiran', 'Zeta', 'Orion', 'Vex', 'Lyric', 'Juno', 'Taro', 'Cassian', 'Rhea', 'Soren', 'Ixa', 'Dax', 'Kael', 'Nyra', 'Talon', 'Vesper', 'Rook', 'Sabra', 'Eon', 'Mirae'],
  lugares: ['Alvorada', 'Pedra Funda', 'Serra Azul', 'Vila Rica', 'Porto Velho', 'Campo Belo', 'Rio Claro', 'Monte Alto', 'Bela Vista', 'Lagoa Seca', 'Boa Esperança', 'Águas Frias'],
  lugaresFantasia: ['Valmar', 'Karnath', 'Eldrath', 'Brumhold', 'Sylvarin', 'Morvenna', 'Thornwick', 'Aldmere', 'Calvoria', 'Duskmar', 'Oakhaven', 'Vellmoor', 'Ostrevia', 'Ravengard'],
}

export type NameStyle = keyof typeof SEEDS

const START = '^'
const END = '$'

/** Pega a primeira palavra de cada nome (sobrenomes e títulos atrapalham o "sotaque"). */
function words(names: string[]): string[] {
  return names
    .map((n) => n.trim().split(/\s+/).find((w) => /^\p{Lu}/u.test(w) && w.length > 2) ?? '')
    .filter((w) => w.length >= 3 && w.length <= 14 && /^[\p{L}'-]+$/u.test(w))
}

/** Gera `count` nomes no estilo de `samples` (ou da lista de partida, com poucos exemplos). */
export function generateNames(samples: string[], style: NameStyle, count = 6, random = Math.random): string[] {
  const own = words(samples)
  // Os nomes do universo pesam mais (o "sotaque" é deles); a lista do gênero dá variedade.
  const base = own.length >= 15 ? own : [...own, ...own, ...words(SEEDS[style])]
  const table = new Map<string, string[]>()
  for (const w of base) {
    const s = START + START + w.toLowerCase() + END
    for (let i = 2; i < s.length; i++) {
      const key = s.slice(i - 2, i)
      table.set(key, [...(table.get(key) ?? []), s[i]])
    }
  }
  const taken = new Set([...samples, ...base].map((n) => fold(n)))
  const out = new Set<string>()
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]
  for (let tries = 0; out.size < count && tries < count * 300; tries++) {
    let name = ''
    let key = START + START
    for (let guard = 0; guard < 14; guard++) {
      const next = table.get(key)
      if (!next) break
      const c = pick(next)
      if (c === END) break
      name += c
      key = key[1] + c
    }
    // Curto, comprido ou gaguejando ("Olaulau") não serve.
    if (name.length < 4 || name.length > 11 || /(.{2,})\1/.test(name)) continue
    const pretty = name.charAt(0).toUpperCase() + name.slice(1)
    if (taken.has(fold(pretty))) continue
    out.add(pretty)
  }
  return [...out]
}
