// O clima da mesa (cores e letras de pedra) vale onde quer que o setor seja ligado.
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '../styles/mesa.css'
import { useSectorClimate } from '../ui/sectorClimate'

/**
 * Entrar na mesa: o app inteiro muda de clima (o tema da mesa, em claro ou escuro), como
 * outro setor da casa. Ao sair, tudo volta às cores de sempre. Numa campanha, o universo
 * todo fica no clima; a tela da mesa só ajusta o tema do grupo aberto.
 */
export function useMesaSector(theme: string | null, dark: boolean, enabled = true) {
  useSectorClimate(enabled ? { sector: 'mesa', ...(theme ? { mesaTema: theme } : {}), mesaModo: dark ? 'escuro' : 'claro' } : null)
}
