export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Nome da tecla modificadora principal neste sistema. */
export const modKey = isMac ? '⌘' : 'Ctrl'
