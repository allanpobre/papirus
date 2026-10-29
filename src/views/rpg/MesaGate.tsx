import { Dices } from 'lucide-react'
import { useEffect, useState } from 'react'

const GATE_KEY = 'papirus:porta-da-mesa'

/** Já se está na mesa (reabriu o app nela, ou entrou no modo sessão): a porta não precisa abrir logo em seguida. */
export function markMesaGate() {
  try {
    sessionStorage.setItem(GATE_KEY, String(Date.now()))
  } catch {
    // Sem armazenamento: a porta pode abrir de novo, nada mais.
  }
}

/** A porta da mesa: abre ao chegar vindo de outra tela (não ao reabrir o app, nem de novo logo em seguida, nem para quem prefere menos movimento). */
export function MesaGate({ name }: { name: string }) {
  const [show, setShow] = useState(() => {
    // Uma vez na chegada; voltar logo depois (de Ajustes, das fichas, do modo sessão…) não repete a porta.
    const recent = (() => {
      try {
        return Date.now() - Number(sessionStorage.getItem(GATE_KEY) ?? 0) < 10 * 60 * 1000
      } catch {
        return false
      }
    })()
    markMesaGate()
    return !recent && performance.now() >= 2500 && !matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 1300)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="mesa-gate" aria-hidden="true">
      <span className="mesa-gate-door mesa-gate-left" />
      <span className="mesa-gate-door mesa-gate-right" />
      <span className="mesa-gate-sign">
        <span className="mesa-gate-emblem">
          <Dices size={34} />
        </span>
        <span className="mesa-gate-title">Mesa de RPG</span>
        <span className="mesa-gate-sub">{name}</span>
      </span>
    </div>
  )
}
