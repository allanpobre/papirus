import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuestionType } from '../logic/continuity'
import { cleanFirstSteps, type FirstSteps } from '../logic/firstSteps'
import type { View } from './workspace'
import { type UniverseKind } from '../model/kind'

/** Preferências deste navegador (não fazem parte do universo). */
export interface Prefs {
  theme: 'sistema' | 'claro' | 'escuro'
  editorFont: 'serifa' | 'sem-serifa' | 'maquina'
  editorSize: number
  /** Tamanho da letra do app inteiro (menus, listas, fichas), além do texto da cena. Sem valor: normal. */
  appScale?: 'normal' | 'grande' | 'maior'
  /** No celular, as partes de cada área (Fichas, Ligações, Mapas…) ficam embaixo, perto do polegar. */
  tabsBottom?: boolean
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
  /** Áreas escondidas do menu de antes dos setores (vale como ponto de partida para a escrita). */
  hiddenViews: View[]
  /** Áreas escondidas do menu, por tipo de universo (continuam acessíveis pela busca e por links). */
  menus: Partial<Record<UniverseKind, View[]>>
  /** O setor aberto no início do app. */
  sector: 'escrita' | 'rpg' | 'oficina' | 'comunidade'
  /** Já viu a apresentação da primeira vez. */
  onboarded: boolean
  /** Primeira vez mais curta: partes que esperam o uso no primeiro universo (sem valor: nunca ligou). */
  firstSteps?: FirstSteps
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
  /** Comemorar meta batida, desafio feito e medalhas novas. */
  celebrate: boolean
  /** Ficha criada e aberta nasce em cartas (rosto, faíscas, ligações). */
  birthCards: boolean
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
    'difere-da-lista': true,
  },
  railCollapsed: false,
  hiddenViews: [],
  menus: {},
  sector: 'escrita',
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
  celebrate: true,
  birthCards: true,
  autoBackup: false,
}

const KEY = 'papirus:prefs'
const SECTORS: Prefs['sector'][] = ['escrita', 'rpg', 'oficina', 'comunidade']

function read(): Prefs {
  try {
    // O Ler/Editar da ficha saiu (a ficha é uma página só): o modo antigo guardado não vale mais.
    localStorage.removeItem('papirus:ficha-modo')
    const raw = localStorage.getItem(KEY)
    // A chave dos testes antigos (da migração para a Nova cara) não vale mais.
    localStorage.removeItem('papirus:cara-antiga')
    if (!raw) return DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<Prefs>
    // Os atalhos que se escolhiam para a barra de baixo (cara antiga) não valem mais: a barra é fixa.
    delete (saved as { phoneShortcuts?: unknown }).phoneShortcuts
    delete (saved as { campaignShortcuts?: unknown }).campaignShortcuts
    // Um setor que não existe mais (o "Mundos", que durou pouco) volta para a Escrita.
    if (saved.sector && !SECTORS.includes(saved.sector)) delete saved.sector
    // A Wiki deixou de ser área do menu: se ficou guardada como escondida, deixa de estar.
    // Primeira vez: lê sem quebrar (parte desconhecida, de outra versão, fica de fora).
    if ('firstSteps' in saved) saved.firstSteps = cleanFirstSteps(saved.firstSteps)
    if (saved.menus) saved.menus = Object.fromEntries(Object.entries(saved.menus).map(([k, v]) => [k, (v ?? []).filter((x) => (x as string) !== 'wiki')]))
    // A Nova cara é a cara de todos (decisão de 30/11/2026): a chave antiga guardada não vale mais.
    delete (saved as { novaCara?: boolean }).novaCara
    return { ...DEFAULT_PREFS, ...saved, continuity: { ...DEFAULT_PREFS.continuity, ...saved.continuity } }
  } catch {
    return DEFAULT_PREFS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read)
  const themeSeen = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Sem armazenamento: as preferências valem só nesta visita.
    }
    const root = document.documentElement
    // Trocar claro/escuro (ou o tema) acontece com uma transição curta de cor, não de uma vez; na abertura, não.
    const before = root.getAttribute('data-theme')
    const now = prefs.theme === 'sistema' ? null : prefs.theme === 'escuro' ? 'dark' : 'light'
    if (themeSeen.current && before !== now && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-fade')
      window.setTimeout(() => root.classList.remove('theme-fade'), 320)
    }
    themeSeen.current = true
    if (prefs.theme === 'sistema') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme === 'escuro' ? 'dark' : 'light')
    // A letra do app inteiro cresce junto (tudo que é medido em rem): para quem lê de longe ou com letra grande.
    root.style.fontSize = prefs.appScale === 'maior' ? '125%' : prefs.appScale === 'grande' ? '112.5%' : ''
    if (prefs.tabsBottom) root.setAttribute('data-abas', 'baixo')
    else root.removeAttribute('data-abas')
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
