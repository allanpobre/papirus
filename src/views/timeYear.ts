/** O ano escolhido na máquina do tempo (vale também para os Mapas). */
export const timeKey = (universeId: string) => `ano-mundo:${universeId}`

/**
 * O ano escolhido vale só enquanto o app está aberto (sessionStorage): ao voltar outro dia,
 * os Mapas mostram tudo de novo, sem marcadores escondidos por um ano esquecido.
 */
export function chosenYear(universeId: string): number | null {
  let v: string | null = null
  try {
    v = sessionStorage.getItem(timeKey(universeId))
  } catch {
    v = null
  }
  return v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
}

export function rememberYear(universeId: string, year: number | null) {
  try {
    if (year === null) sessionStorage.removeItem(timeKey(universeId))
    else sessionStorage.setItem(timeKey(universeId), String(year))
  } catch {
    // Sem armazenamento: o ano vale só nesta tela.
  }
}
