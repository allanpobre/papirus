import { useEffect, useLayoutEffect, useRef } from 'react'

/*
 * Indicador que desliza: o "fundo" da aba ou do botão escolhido anda até o novo lugar em vez de pular. O gancho
 * mede o item ativo e guarda a posição em variáveis CSS do contêiner (`--slide-x/y/w/h`); o desenho é do CSS
 * (`[data-slide]::before`, em base.css). Na primeira medida não anima (senão o fundo "chegaria" voando ao abrir).
 * Sem o gancho, ou sem item ativo, nada muda: o fundo do próprio botão continua valendo.
 */
export function useSlide<T extends HTMLElement>(activeSelector: string, key?: unknown) {
  const ref = useRef<T>(null)
  const measure = () => {
    const box = ref.current
    const on = box?.querySelector<HTMLElement>(activeSelector)
    if (!box || !on) {
      if (box) delete box.dataset.slide
      return
    }
    box.style.setProperty('--slide-x', `${on.offsetLeft}px`)
    box.style.setProperty('--slide-y', `${on.offsetTop}px`)
    box.style.setProperty('--slide-w', `${on.offsetWidth}px`)
    box.style.setProperty('--slide-h', `${on.offsetHeight}px`)
    box.dataset.slide = 'on'
  }
  useLayoutEffect(measure, [activeSelector, key])
  useEffect(() => {
    const box = ref.current
    if (!box) return
    // Depois do primeiro desenho, passa a animar as trocas; e remede se o tamanho mudar (fonte, janela, rótulo curto).
    const raf = requestAnimationFrame(() => (box.dataset.slideReady = ''))
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(box)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}
