/** Tab e Shift+Tab giram dentro da janela, sem escapar para a página atrás. */
export function trapFocus(e: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const items = [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
    ),
  ].filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
