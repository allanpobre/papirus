const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const full = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Começo do dia (meia-noite local), para contar dias de calendário e não de 24 horas. */
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/**
 * Quando foi, do jeito que se fala: "hoje, 23:03", "ontem", "há 3 dias", "há 2 semanas", "há 4 meses".
 * Mais de um ano: a data ("7 de nov. de 2025").
 */
export function relativeDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400000)
  if (days <= 0) return `hoje, ${time.format(d)}`
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return w === 1 ? 'há 1 semana' : `há ${w} semanas`
  }
  if (days < 365) {
    const m = Math.max(1, Math.floor(days / 30))
    return m === 1 ? 'há 1 mês' : `há ${m} meses`
  }
  return full.format(d)
}
