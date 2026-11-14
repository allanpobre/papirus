import { type Scene } from '../../model/schema'
import { recall, remember } from '../../state/prefs'

/** Em que modo a tela de escrever abre: o último usado (Página, se nunca mudou). */
export const savedMode = (): 'pagina' | 'revisao' => (recall('escrita-modo') === 'revisao' ? 'revisao' : 'pagina')

export const saveMode = (m: 'pagina' | 'revisao') => remember('escrita-modo', m)

export const SHIFT_LABEL: Record<Exclude<Scene['shift'], ''>, string> = { melhor: 'Melhor', pior: 'Pior', igual: 'Igual' }
