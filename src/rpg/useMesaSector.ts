import { useEffect } from 'react'

/** Quantos lugares pedem o clima da mesa agora (a campanha inteira e a tela da mesa). */
let holders = 0

/**
 * Entrar na mesa: o app inteiro muda de clima (o tema da mesa, em claro ou escuro), como
 * outro setor da casa. Ao sair, tudo volta às cores de sempre. Numa campanha, o universo
 * todo fica no clima; a tela da mesa só ajusta o tema do grupo aberto.
 */
export function useMesaSector(theme: string | null, dark: boolean, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const b = document.body.dataset
    b.sector = 'mesa'
    if (theme) b.mesaTema = theme
    else delete b.mesaTema
    b.mesaModo = dark ? 'escuro' : 'claro'
  }, [theme, dark, enabled])
  useEffect(() => {
    if (!enabled) return
    holders++
    return () => {
      holders--
      if (holders > 0) return
      const b = document.body.dataset
      delete b.sector
      delete b.mesaTema
      delete b.mesaModo
    }
  }, [enabled])
}
