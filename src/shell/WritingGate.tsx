import { Feather } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Picture } from '../images/Picture'

/**
 * A entrada de um universo de escrita: a capa do livro abre, como a porta da mesa abre na
 * campanha. Só ao chegar vindo do início (não ao reabrir o app, nem de novo logo em seguida,
 * nem para quem prefere menos movimento).
 */
export function WritingGate({ id, name, cover }: { id: string; name: string; cover?: string | null }) {
  const [show, setShow] = useState(() => {
    if (performance.now() < 2500 || matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    try {
      const key = `papirus:capa-aberta:${id}`
      const last = Number(sessionStorage.getItem(key) ?? 0)
      sessionStorage.setItem(key, String(Date.now()))
      return Date.now() - last > 10 * 60 * 1000
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 1500)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="book-gate" aria-hidden="true">
      <span className="book-gate-page" />
      <span className="book-gate-cover">
        {cover && <Picture value={cover} className="book-gate-art" />}
        <span className="book-gate-sign">
          <span className="book-gate-kicker">
            <Feather size={14} /> Escrita
          </span>
          <span className="book-gate-title">{name}</span>
          <span className="book-gate-rule" />
        </span>
      </span>
    </div>
  )
}
