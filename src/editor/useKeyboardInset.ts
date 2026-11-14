import { useEffect, useState } from 'react'

/** Quanto o teclado do celular cobre a página (pela área visível do navegador). */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

/** A partir deste tanto coberto, é teclado (e não a barra do navegador que aparece e some). */
export const KEYBOARD_MIN_INSET = 120
