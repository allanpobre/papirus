import { useEffect, useState } from 'react'

/** Uma chuva rápida de confete, para comemorar. Some sozinha; sem animação para quem prefere menos movimento. */
const COLORS = ['#1d6b58', '#e0a526', '#c0577a', '#2f6fae', '#7b5ea7', '#e46f3c']
let fire: (() => void) | null = null

export function celebrate() {
  fire?.()
}

export function Confetti() {
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    fire = () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      setBurst((b) => b + 1)
    }
    return () => {
      fire = null
    }
  }, [])
  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 2600)
    return () => clearTimeout(t)
  }, [burst])
  if (!burst) return null
  return (
    <div className="confetti" aria-hidden="true" key={burst}>
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 9) * 0.06}s`,
            animationDuration: `${1.6 + ((i * 7) % 10) / 10}s`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}
