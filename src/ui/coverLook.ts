/** Cores de capa: as tintas do Papirus, escuras o bastante para a letra clara por cima. */
const TONES = ['#1d6b58', '#2d6290', '#8b2f52', '#6a4ea3', '#8a5a12', '#0f6f7a', '#a4462a', '#3a4a44', '#55752a']
const MOTIFS = 6

/** Um número a partir do texto (FNV-1a): o mesmo nome dá sempre a mesma capa. */
export function coverSeed(text: string): number {
  let h = 0x811c9dc5
  for (const ch of text.trim().toLocaleLowerCase('pt-BR')) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A cor e o desenho de uma capa gerada. */
export function coverLook(name: string): { tone: string; motif: number } {
  const seed = coverSeed(name)
  return { tone: TONES[seed % TONES.length], motif: (seed >>> 8) % MOTIFS }
}
