import { remember } from '../../state/prefs'

/** Avisa a Mesa já aberta que deve recomeçar no lugar guardado (grupo, aba e ficha). */
export const MESA_REOPEN = 'papirus:mesa-reabrir'

/**
 * Deixa guardado onde a Mesa deve abrir: o grupo, a aba Grupo e a ficha. Se a Mesa já está na
 * tela, ela recomeça ali (sem isto, mudar o guardado não muda o que já está aberto).
 */
export function openSheetInMesa(universeId: string, groupId: string | null, sheetId: string) {
  if (groupId) remember(`rpg-grupo:${universeId}`, groupId)
  remember('rpg-aba', 'personagens')
  remember('rpg-ficha', sheetId)
  dispatchEvent(new Event(MESA_REOPEN))
}
