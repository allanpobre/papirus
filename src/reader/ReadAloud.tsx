import { Headphones, Pause, Play, X } from 'lucide-react'
import { canSpeak, useReadAloud } from './useReadAloud'

export function ReadAloudButton({ onStart }: { onStart: () => void }) {
  if (!canSpeak()) return null
  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={onStart} title="Ouvir o capítulo em voz alta">
      <Headphones size={15} aria-hidden="true" /> <span className="leitor-btn-label">Ouvir</span>
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
