export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Nome da tecla modificadora principal neste sistema. */
export const modKey = isMac ? '⌘' : 'Ctrl'

/**
 * Setas, Home e End movem entre as abas de um `role="tablist"` e ativam a aba,
 * como esperam leitores de tela. Use em `onKeyDown` do tablist.
 */
export function tabListKeys(e: React.KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'))
  const i = tabs.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
  if (next < 0) return
  e.preventDefault()
  tabs[next].focus()
  tabs[next].click()
}
