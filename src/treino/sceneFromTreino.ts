import { docFromParagraphs } from '../model/doc'
import type { Universe } from '../model/schema'
import { addScene, updateScene } from '../model/universe'
import type { Treino } from './treino'

/** O texto de um treino (ou de um passo da Oficina) vira uma cena solta, com a proposta na sinopse. */
export function sceneFromTreino(u: Universe, t: Treino): Universe {
  const paragraphs = t.text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const [next, sc] = addScene(u, null, `Treino: ${t.prompt.slice(0, 48)}${t.prompt.length > 48 ? '…' : ''}`)
  return updateScene(next, sc.id, { synopsis: t.prompt, doc: docFromParagraphs(paragraphs), text: paragraphs.join('\n\n') })
}
