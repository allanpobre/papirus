import { useEffect } from 'react'
import type { Clima } from '../model/climas'

/** As letras de cada clima, baixadas só quando o clima é usado. */
const FONTS: Partial<Record<Clima, () => Promise<unknown>>> = {
  fantasia: () => Promise.all([import('@fontsource/cinzel/400.css'), import('@fontsource/cinzel/600.css'), import('@fontsource/eb-garamond/400.css'), import('@fontsource/eb-garamond/600.css')]),
  ficcao: () => Promise.all([import('@fontsource/ibm-plex-mono/400.css'), import('@fontsource/ibm-plex-mono/600.css')]),
  terror: () => Promise.all([import('@fontsource/playfair-display/400.css'), import('@fontsource/playfair-display/700.css'), import('@fontsource/crimson-pro/400.css'), import('@fontsource/crimson-pro/600.css')]),
}

/**
 * O clima do mundo vale no app inteiro enquanto o universo está aberto (com a "Nova cara"). Sem clima
 * (ou caderno), nada muda. Ao fechar o universo, volta ao de sempre.
 */
/** A Nova cara está ligada (algumas peças mudam de lugar, como a régua no rodapé). */
export function useNovaFlag(on: boolean) {
  useEffect(() => {
    if (!on) return
    document.body.dataset.nova = ''
    return () => {
      delete document.body.dataset.nova
    }
  }, [on])
}

export function useWorldClimate(clima: Clima | null, modo: 'escuro' | 'claro' = 'escuro') {
  useEffect(() => {
    if (!clima || clima === 'caderno') return
    void import('../styles/climas.css')
    void FONTS[clima]?.().catch(() => undefined)
    document.body.dataset.clima = clima
    document.body.dataset.climaModo = modo
    return () => {
      delete document.body.dataset.clima
      delete document.body.dataset.climaModo
    }
  }, [clima, modo])
}
