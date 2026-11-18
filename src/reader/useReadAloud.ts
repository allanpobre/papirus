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

/** Tela acesa enquanto lê (quando o navegador deixa): sem ela, o celular apaga e a voz para. */
type Sentinel = { release: () => Promise<void> }
async function keepAwake(): Promise<Sentinel | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }
    return (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    return null
  }
}

/**
 * `memoryKey`: onde guardar o parágrafo em que a voz está (para voltar dali, mesmo depois de fechar).
 * `title`: o nome que aparece nos controles da tela de bloqueio, quando o navegador mostra.
 */
export function useReadAloud(
  container: React.RefObject<HTMLElement | null>,
  sceneKey: string,
  onSceneEnd: () => boolean,
  opts: { memoryKey?: string; title?: string } = {},
) {
  const [state, setState] = useState<'parado' | 'lendo' | 'pausado'>('parado')
  const awake = useRef<Sentinel | null>(null)
  const sceneRef = useRef(sceneKey)
  const optsRef = useRef(opts)
  const wake = (on: boolean) => {
    if (!on) {
      void awake.current?.release().catch(() => undefined)
      awake.current = null
    } else if (!awake.current) void keepAwake().then((s) => (awake.current = s))
  }
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
    sceneRef.current = sceneKey
    optsRef.current = opts
    speakFrom.current = (i) => {
      const root = container.current
      const list = [...(root?.querySelectorAll<HTMLElement>('.leitor-text > *') ?? [])].filter((el) => el.textContent?.trim())
      if (i >= list.length) {
        markSpeaking(root, null)
        // Fim do capítulo: segue para o próximo, se houver.
        if (!endRef.current()) {
          playing.current = false
          setState('parado')
          wake(false)
          // Chegou ao fim: da próxima vez, começa do começo do capítulo em que estiver.
          if (optsRef.current.memoryKey) remember(optsRef.current.memoryKey, null)
        }
        return
      }
      index.current = i
      if (optsRef.current.memoryKey) remember(optsRef.current.memoryKey, JSON.stringify({ scene: sceneRef.current, i }))
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

  /** Onde a voz parou neste capítulo (0 se foi em outro, ou nunca). */
  const savedIndex = () => {
    try {
      const saved = JSON.parse(recall(opts.memoryKey ?? '') ?? 'null') as { scene?: string; i?: number } | null
      return saved && saved.scene === sceneKey && typeof saved.i === 'number' ? saved.i : 0
    } catch {
      return 0
    }
  }
  const start = () => {
    speechSynthesis.cancel()
    playing.current = true
    setState('lendo')
    wake(true)
    speakFrom.current(opts.memoryKey ? savedIndex() : 0)
  }
  const stop = () => {
    playing.current = false
    speechSynthesis.cancel()
    markSpeaking(container.current, null)
    setState('parado')
    wake(false)
  }
  const pause = () => {
    speechSynthesis.pause()
    setState('pausado')
    wake(false)
  }
  const resume = () => {
    speechSynthesis.resume()
    setState('lendo')
    wake(true)
  }

  // Controles da tela de bloqueio e dos fones (quando o navegador mostra): tocar, pausar e parar.
  const controls = useRef({ pause, resume, stop })
  useEffect(() => {
    controls.current = { pause, resume, stop }
  })
  useEffect(() => {
    if (!('mediaSession' in navigator) || state === 'parado') return
    const ms = navigator.mediaSession
    try {
      if (typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: opts.title ?? 'Ouvir o livro', artist: 'Papirus' })
      ms.playbackState = state === 'lendo' ? 'playing' : 'paused'
      ms.setActionHandler('play', () => controls.current.resume())
      ms.setActionHandler('pause', () => controls.current.pause())
      ms.setActionHandler('stop', () => controls.current.stop())
    } catch {
      // Navegador sem alguma das ações: os botões da tela continuam valendo.
    }
  }, [state, opts.title])
  // A tela voltou (o celular apagou e acendeu): pede de novo para ficar acesa, se ainda está lendo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && playing.current && state === 'lendo') {
        awake.current = null
        wake(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  })
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
      void awake.current?.release().catch(() => undefined)
    },
    [],
  )

  return { state, rate, start, stop, pause, resume, cycleRate }
}
