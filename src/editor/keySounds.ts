/**
 * Som ao digitar, gerado na hora (sem arquivos): um estalo curto de ruído filtrado.
 * "maquina" é mais seco e tem sininho no Enter; "suave" é um toque baixo de teclado.
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  return ctx
}

function click(c: AudioContext, freq: number, volume: number, length: number) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.2
  const gain = c.createGain()
  const t = c.currentTime
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  src.connect(filter).connect(gain).connect(c.destination)
  src.start(t)
  src.stop(t + length + 0.02)
}

function bell(c: AudioContext) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 2093
  const gain = c.createGain()
  const t = c.currentTime + 0.05
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.06, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  osc.connect(gain).connect(c.destination)
  osc.start()
  osc.stop(t + 1)
}

/**
 * Liga o áudio. Navegadores (sobretudo no celular) só deixam tocar som se o áudio for ligado
 * no próprio toque ou tecla: chame isto direto no evento, sem esperar nada antes.
 */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume()
}

export type KeyKind = 'letra' | 'espaco' | 'enter' | 'apagar'

/** O tipo de tecla a partir do que o texto recebeu (funciona também com o teclado do celular). */
export function keyKindOf(e: InputEvent): KeyKind | null {
  switch (e.inputType) {
    case 'insertParagraph':
    case 'insertLineBreak':
      return 'enter'
    case 'deleteContentBackward':
    case 'deleteContentForward':
    case 'deleteWordBackward':
      return 'apagar'
    case 'insertText':
    case 'insertReplacementText':
    case 'insertCompositionText':
      return e.data === ' ' ? 'espaco' : 'letra'
    default:
      return null
  }
}

/** Toca o som de uma tecla. */
export function playKey(kind: 'suave' | 'maquina', key: KeyKind) {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  if (kind === 'maquina') {
    click(c, key === 'espaco' ? 900 : 2600, key === 'espaco' ? 0.35 : 0.28, 0.05)
    click(c, 180, 0.18, 0.04)
    if (key === 'enter') bell(c)
  } else {
    click(c, key === 'espaco' ? 1200 : 3400, 0.08, 0.025)
  }
}
