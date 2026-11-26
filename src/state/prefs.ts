import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuestionType } from '../logic/continuity'
import { cleanFirstSteps, type FirstSteps } from '../logic/firstSteps'
import type { View } from './workspace'
import { CAMPAIGN_SHORTCUTS, type UniverseKind } from '../model/kind'

/** Preferências deste navegador (não fazem parte do universo). */
export interface Prefs {
  theme: 'sistema' | 'claro' | 'escuro'
  editorFont: 'serifa' | 'sem-serifa' | 'maquina'
  editorSize: number
  /** Tamanho da letra do app inteiro (menus, listas, fichas), além do texto da cena. Sem valor: normal. */
  appScale?: 'normal' | 'grande' | 'maior'
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
  /** A Nova cara (o clima de cada mundo no app inteiro, a barra com os lugares grandes). Desde 30/11/2026, sempre ligada. */
  novaCara?: boolean
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
  /** Os atalhos da barra de baixo no celular (até 4). */
  phoneShortcuts: View[]
  /** Os atalhos da barra de baixo numa campanha. */
  campaignShortcuts: View[]
}

export type Accent = 'viridiana' | 'azul' | 'vinho' | 'violeta' | 'ocre' | 'grafite' | 'rosa' | 'turquesa' | 'terracota'

export const DEFAULT_PREFS: Prefs = {
  theme: 'sistema',
  novaCara: true,
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
  phoneShortcuts: ['inicio', 'escrever', 'fichas', 'tramas'],
  campaignShortcuts: CAMPAIGN_SHORTCUTS,
}

const KEY = 'papirus:prefs'
const SECTORS: Prefs['sector'][] = ['escrita', 'rpg', 'oficina', 'comunidade']
const OLD_PHONE_SHORTCUTS = 'inicio,escrever,livro,fichas'

function read(): Prefs {
  try {
    // O Ler/Editar da ficha saiu (a ficha é uma página só): o modo antigo guardado não vale mais.
    localStorage.removeItem('papirus:ficha-modo')
    const raw = localStorage.getItem(KEY)
    if (!raw) return localStorage.getItem('papirus:cara-antiga') === '1' ? { ...DEFAULT_PREFS, novaCara: false } : DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<Prefs>
    // A barra padrão antiga (Início, Escrever, Livro, Mundo) foi gravada com as outras preferências
    // por quem nunca escolheu atalhos: essa pessoa ganha a barra padrão nova.
    if (saved.phoneShortcuts?.join() === OLD_PHONE_SHORTCUTS) delete saved.phoneShortcuts
    // Um setor que não existe mais (o "Mundos", que durou pouco) volta para a Escrita.
    if (saved.sector && !SECTORS.includes(saved.sector)) delete saved.sector
    // A Wiki deixou de ser área do menu: se ficou guardada como escondida, deixa de estar.
    // Primeira vez: lê sem quebrar (parte desconhecida, de outra versão, fica de fora).
    if ('firstSteps' in saved) saved.firstSteps = cleanFirstSteps(saved.firstSteps)
    if (saved.menus) saved.menus = Object.fromEntries(Object.entries(saved.menus).map(([k, v]) => [k, (v ?? []).filter((x) => (x as string) !== 'wiki')]))
    // A Nova cara é a cara de todos (decisão de 30/11/2026): o valor antigo guardado, ligado ou não, não vale mais.
    // Exceção só dos testes antigos, enquanto migram área por área: a chave “papirus:cara-antiga” existe apenas nas
    // preparações dos testes (e2e/fixtures.ts). Sai junto com o último caminho antigo do código.
    saved.novaCara = saved.novaCara === true || localStorage.getItem('papirus:cara-antiga') !== '1'
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
