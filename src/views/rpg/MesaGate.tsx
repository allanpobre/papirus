import { Dices } from 'lucide-react'
import { useEffect, useState } from 'react'

/** A porta da mesa: abre ao chegar vindo de outra tela (não ao reabrir o app, nem de novo logo em seguida, nem para quem prefere menos movimento). */
export function MesaGate({ name }: { name: string }) {
  const [show, setShow] = useState(() => {
    if (performance.now() < 2500 || matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    // Uma vez na chegada; voltar logo depois (de Ajustes, das fichas…) não repete a porta.
    try {
      const last = Number(sessionStorage.getItem('papirus:porta-da-mesa') ?? 0)
      sessionStorage.setItem('papirus:porta-da-mesa', String(Date.now()))
      return Date.now() - last > 10 * 60 * 1000
    } catch {
      return true
    }
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
