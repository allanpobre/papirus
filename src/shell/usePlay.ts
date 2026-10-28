import { useEffect } from 'react'
import { deadlinePlan } from '../logic/deadline'
import { CHALLENGE_WORDS, challenges, challengesDone, markMedalsSeen, MEDALS, saveChallenge, seenMedals } from '../logic/play'
import { todayKey } from '../logic/stats'
import { isLocalOnly } from '../model/sample'
import type { Universe } from '../model/schema'
import { countWords, wordCount, type Library } from '../persistence/repository'
import { todayTotal, wordsHistory } from '../social/dailyWords'
import { recall, remember } from '../state/prefs'
import { celebrate } from '../ui/Confetti'

/** Palavras em todos os universos deste aparelho (sem o exemplo), com o aberto já atualizado. */
export async function totalWritten(library: Library, current: Universe): Promise<number> {
  const entries = await library.list()
  const others = entries.filter((e) => e.id !== current.id && !e.sample).reduce((n, e) => n + e.words, 0)
  return others + (isLocalOnly(current) ? 0 : countWords(current))
}

/**
 * Depois de uma pausa na escrita: confere o desafio do dia, a meta e as medalhas, e
 * comemora o que for novo (se a pessoa quiser comemorações).
 */
export function usePlay(universe: Universe, library: Library, readOnly: boolean, on: boolean, toast: (m: string) => void) {
  useEffect(() => {
    if (readOnly) return
    let off = false
    const t = setTimeout(async () => {
      const day = todayKey()
      // Desafio do dia: conta como feito com as palavras na cena dele.
      const rec = challenges()[day]
      if (rec && rec.universeId === universe.id && !rec.done) {
        const scene = universe.scenes.find((s) => s.id === rec.sceneId)
        if (scene && wordCount(scene.text) >= CHALLENGE_WORDS) {
          saveChallenge(day, { ...rec, done: true })
          if (on) {
            toast('🎲 Desafio do dia feito!')
            celebrate()
          }
        }
      }
      if (isLocalOnly(universe)) return
      // Meta do dia (ou o que o prazo do livro pede).
      const goal = Math.max(universe.settings.dailyWordGoal, deadlinePlan(universe)?.perDay ?? 0)
      if (goal > 0 && todayTotal() >= goal && recall('meta-comemorada') !== day) {
        remember('meta-comemorada', day)
        if (on) {
          toast('🎉 Meta do dia batida!')
          celebrate()
        }
      }
      // Medalhas novas.
      const total = await totalWritten(library, universe)
      if (off) return
      const stats = { totalWords: total, history: wordsHistory(), goal: universe.settings.dailyWordGoal, challengesDone: challengesDone(), entities: universe.entities.length }
      const got = MEDALS.filter((m) => m.got(stats)).map((m) => m.id)
      const seen = seenMedals()
      if (seen === null) return markMedalsSeen(got)
      const fresh = MEDALS.filter((m) => got.includes(m.id) && !seen.includes(m.id))
      if (!fresh.length) return
      markMedalsSeen([...new Set([...seen, ...got])])
      if (on) {
        for (const m of fresh) toast(`${m.emoji} Nova medalha: ${m.name}`)
        celebrate()
      }
    }, 2000)
    return () => {
      off = true
      clearTimeout(t)
    }
  }, [universe, library, readOnly, on, toast])
}
