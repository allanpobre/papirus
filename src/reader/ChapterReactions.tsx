import { CHAPTER_EMOJIS, EMOJI_NAME, type ChapterEmoji } from '../social/chapterReactions'

export interface ReactionsApi {
  counts: (sceneId: string) => Partial<Record<ChapterEmoji, number>>
  mine: (sceneId: string) => ChapterEmoji | null
  /** `null` tira a reação. Sem conta, pede para entrar. */
  react: (sceneId: string, emoji: ChapterEmoji | null) => void
}

/** No fim do capítulo: o que você achou? Um toque reage; tocar de novo tira. */
export function ChapterReactions({ sceneId, api }: { sceneId: string; api: ReactionsApi }) {
  const counts = api.counts(sceneId)
  const mine = api.mine(sceneId)
  return (
    <div className="leitor-reactions" role="group" aria-label="Reagir a este capítulo">
      {CHAPTER_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className="leitor-reaction"
          aria-pressed={mine === e}
          aria-label={`${EMOJI_NAME[e]}${counts[e] ? ` (${counts[e]})` : ''}`}
          title={EMOJI_NAME[e]}
          onClick={() => api.react(sceneId, mine === e ? null : e)}
        >
          <span aria-hidden="true">{e}</span>
          {counts[e] ? <span className="tabular">{counts[e]}</span> : null}
        </button>
      ))}
    </div>
  )
}
