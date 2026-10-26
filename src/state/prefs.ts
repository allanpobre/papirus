import { useCallback, useEffect, useState } from 'react'
import type { QuestionType } from '../logic/continuity'
import type { View } from './workspace'

/** Preferências deste navegador (não fazem parte do universo). */
export interface Prefs {
  theme: 'sistema' | 'claro' | 'escuro'
  editorFont: 'serifa' | 'sem-serifa' | 'maquina'
  editorSize: number
  editorWidth: 'estreita' | 'media' | 'larga'
  /** Destacar nomes de fichas conhecidas no texto. */
  detection: boolean
  /** Procurar nomes ainda não cadastrados. */
  discovery: boolean
  /** Margem viva ao lado do editor. */
  margin: boolean
  /** Barra de formatação acima do texto. */
  toolbar: boolean
  continuity: Record<QuestionType, boolean>
  railCollapsed: boolean
  /** Áreas escondidas do menu (continuam acessíveis pela busca e por links). */
  hiddenViews: View[]
  /** Já viu a apresentação da primeira vez. */
  onboarded: boolean
  /** Último backup baixado e "lembrar depois", por universo (ISO). */
  backups: Record<string, { last?: string; snoozeUntil?: string }>
  /** Servidor do Codex ao vivo (Supabase). Vazio = usa o da publicação, se houver. */
  server: { url: string; anonKey: string }
  /** Endereço público do Papirus, usado nos links dos jogadores. Vazio = o padrão. */
  publicUrl: string
  /** Já fez (ou pulou) o tour guiado. */
  tourDone: boolean
  /** Cor de destaque do app. */
  accent: Accent
  /** Modo máquina de escrever: a linha em que se escreve fica no meio da tela. */
  typewriter: boolean
  /** Só o parágrafo atual em destaque; os outros ficam claros. */
  focusParagraph: boolean
  /** Som ao digitar (só no editor). */
  keySound: 'nenhum' | 'suave' | 'maquina'
  /** Contar aos amigos quando bater a meta do dia (e os dias seguidos). */
  shareProgress: boolean
  /** Baixar o backup sozinho, uma vez por semana, ao abrir um universo com novidades. */
  autoBackup: boolean
}

export type Accent = 'viridiana' | 'azul' | 'vinho' | 'violeta' | 'ocre' | 'grafite' | 'rosa' | 'turquesa' | 'terracota'

export const DEFAULT_PREFS: Prefs = {
  theme: 'sistema',
  editorFont: 'serifa',
  editorSize: 19,
  editorWidth: 'media',
  detection: true,
  discovery: true,
  margin: true,
  toolbar: true,
  continuity: {
    'presenca-dupla': true,
    'apos-fim': true,
    'antes-inicio': true,
    'fatos-divergentes': true,
    'descricao-divergente': true,
    'morto-reaparece': true,
    'nome-parecido': true,
    'data-impossivel': true,
  },
  railCollapsed: false,
  hiddenViews: [],
  onboarded: false,
  backups: {},
  server: { url: '', anonKey: '' },
  publicUrl: '',
  tourDone: false,
  accent: 'viridiana',
  typewriter: false,
  focusParagraph: false,
  keySound: 'nenhum',
  shareProgress: true,
  autoBackup: false,
}

const KEY = 'papirus:prefs'

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<Prefs>
    return { ...DEFAULT_PREFS, ...saved, continuity: { ...DEFAULT_PREFS.continuity, ...saved.continuity } }
  } catch {
    return DEFAULT_PREFS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Sem armazenamento: as preferências valem só nesta visita.
    }
    const root = document.documentElement
    if (prefs.theme === 'sistema') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme === 'escuro' ? 'dark' : 'light')
    if (prefs.accent === 'viridiana') root.removeAttribute('data-accent')
    else root.setAttribute('data-accent', prefs.accent)
  }, [prefs])

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  return { prefs, setPref, setPrefs }
}

/** Lembra pequenos valores por navegador (ex.: última cena aberta). */
export function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(`papirus:${key}`)
    else localStorage.setItem(`papirus:${key}`, value)
  } catch {
    // Ignorado.
  }
}

export function recall(key: string): string | null {
  try {
    return localStorage.getItem(`papirus:${key}`)
  } catch {
    return null
  }
}
