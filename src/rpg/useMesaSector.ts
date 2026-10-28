import { useEffect } from 'react'

/**
 * Entrar na mesa: o app inteiro muda de clima (o tema da mesa, em claro ou escuro), como
 * outro setor da casa. Ao sair, tudo volta às cores de sempre.
 */
export function useMesaSector(theme: string | null, dark: boolean) {
  useEffect(() => {
    const b = document.body.dataset
    b.sector = 'mesa'
    if (theme) b.mesaTema = theme
    else delete b.mesaTema
    b.mesaModo = dark ? 'escuro' : 'claro'
  }, [theme, dark])
  useEffect(
    () => () => {
      const b = document.body.dataset
      delete b.sector
      delete b.mesaTema
      delete b.mesaModo
    },
    [],
  )
}
