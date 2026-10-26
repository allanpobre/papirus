import { Headphones, Pause, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { recall, remember } from '../state/prefs'

/**
 * Ouvir o livro: o navegador lê o capítulo em voz alta, parágrafo por parágrafo,
 * destacando onde está. No fim do capítulo, segue para o próximo.
 */
const SPEEDS = [0.8, 1, 1.2, 1.5] as const
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

function ptVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'pt-BR') ?? voices.find((v) => v.lang.toLowerCase().startsWith('pt')) ?? null
}

/** Destaca o parágrafo que está sendo lido (e só ele). */
function markSpeaking(root: HTMLElement | null, el: HTMLElement | null) {
  root?.querySelectorAll('.is-speaking').forEach((e) => e.classList.remove('is-speaking'))
  if (el) {
    el.classList.add('is-speaking')
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

export function useReadAloud(container: React.RefObject<HTMLElement | null>, sceneKey: string, onSceneEnd: () => boolean) {
  const [state, setState] = useState<'parado' | 'lendo' | 'pausado'>('parado')
  const [rate, setRate] = useState<number>(() => Number(recall('voz-velocidade')) || 1)
  const index = useRef(0)
  const playing = useRef(false)
  const rateRef = useRef(rate)
  const endRef = useRef(onSceneEnd)
  // Lê do parágrafo `i` em diante; guardado numa ref para o fim de cada fala chamar o próximo.
  const speakFrom = useRef<(i: number) => void>(() => undefined)
  useEffect(() => {
    endRef.current = onSceneEnd
    rateRef.current = rate
    speakFrom.current = (i) => {
      const root = container.current
      const list = [...(root?.querySelectorAll<HTMLElement>('.leitor-text > *') ?? [])].filter((el) => el.textContent?.trim())
      if (i >= list.length) {
        markSpeaking(root, null)
        // Fim do capítulo: segue para o próximo, se houver.
        if (!endRef.current()) {
          playing.current = false
          setState('parado')
        }
        return
      }
      index.current = i
      markSpeaking(root, list[i])
      const u = new SpeechSynthesisUtterance(list[i].textContent ?? '')
      u.lang = 'pt-BR'
      const v = ptVoice()
      if (v) u.voice = v
      u.rate = rateRef.current
      u.onend = () => {
        if (playing.current) speakFrom.current(index.current + 1)
      }
      speechSynthesis.speak(u)
    }
  })

  const start = () => {
    speechSynthesis.cancel()
    playing.current = true
    setState('lendo')
    speakFrom.current(0)
  }
  const stop = () => {
    playing.current = false
    speechSynthesis.cancel()
    markSpeaking(container.current, null)
    setState('parado')
  }
  const pause = () => {
    speechSynthesis.pause()
    setState('pausado')
  }
  const resume = () => {
    speechSynthesis.resume()
    setState('lendo')
  }
  const cycleRate = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]
    setRate(next)
    rateRef.current = next
    remember('voz-velocidade', String(next))
    // A velocidade nova vale já: recomeça o parágrafo atual.
    if (playing.current) {
      speechSynthesis.cancel()
      setState('lendo')
      setTimeout(() => speakFrom.current(index.current), 50)
    }
  }

  // Capítulo novo enquanto lê: continua do começo dele.
  useEffect(() => {
    if (!playing.current) return
    const t = setTimeout(() => speakFrom.current(0), 300)
    return () => clearTimeout(t)
  }, [sceneKey])

  // Sair da leitura cala a voz.
  useEffect(
    () => () => {
      playing.current = false
      if (canSpeak()) speechSynthesis.cancel()
    },
    [],
  )

  return { state, rate, start, stop, pause, resume, cycleRate }
}

export function ReadAloudButton({ onStart }: { onStart: () => void }) {
  if (!canSpeak()) return null
  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={onStart} title="Ouvir o capítulo em voz alta">
      <Headphones size={15} /> Ouvir
    </button>
  )
}

export function ReadAloudBar({ voice }: { voice: ReturnType<typeof useReadAloud> }) {
  if (voice.state === 'parado') return null
  return (
    <div className="leitor-voz" role="group" aria-label="Leitura em voz alta">
      {voice.state === 'lendo' ? (
        <button type="button" className="btn-icon" aria-label="Pausar" onClick={voice.pause}>
          <Pause size={18} />
        </button>
      ) : (
        <button type="button" className="btn-icon" aria-label="Continuar" onClick={voice.resume}>
          <Play size={18} />
        </button>
      )}
      <span className="small">{voice.state === 'lendo' ? 'Lendo em voz alta' : 'Pausado'}</span>
      <button type="button" className="btn btn-sm btn-ghost tabular" aria-label={`Velocidade ${voice.rate}x`} onClick={voice.cycleRate}>
        {String(voice.rate).replace('.', ',')}x
      </button>
      <button type="button" className="btn-icon" aria-label="Parar de ouvir" onClick={voice.stop}>
        <X size={18} />
      </button>
    </div>
  )
}
