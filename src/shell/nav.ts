import {
  BookOpenText,
  CalendarRange,
  Dices,
  Earth,
  Feather,
  Globe,
  GraduationCap,
  House,
  Inbox,
  Lightbulb,
  MapIcon,
  MessageCircleQuestion,
  Network,
  PanelsTopLeft,
  Settings,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import type { View } from '../state/workspace'

/** Áreas do menu lateral, em grupos. */
export interface NavItem {
  view: View
  label: string
  icon: LucideIcon
  /** Outras palavras que acham a área na busca (nomes antigos, sinônimos). */
  words?: string
  /** Mora dentro de outra área do menu (que fica marcada quando esta está aberta); a busca ainda acha. */
  inside?: View
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ view: 'inicio', label: 'Início', icon: House }] },
  {
    group: 'Escrita',
    items: [
      { view: 'escrever', label: 'Escrever', icon: Feather },
      // A Estrutura é um dos três momentos de Escrever (Estrutura · Página · Revisão).
      { view: 'organizar', label: 'Estrutura', icon: PanelsTopLeft, inside: 'escrever', words: 'mapa da história mapa organizar quadro de cenas cortiça ritmo presença atos promessas' },
      { view: 'livro', label: 'Publicar', icon: BookOpenText, words: 'livro livros pdf epub word capa leitores beta exportar baixar' },
    ],
  },
  {
    // Mundo e Trama: cada um com as suas partes no alto da tela (como Estrutura · Página · Revisão na escrita).
    group: '',
    items: [
      { view: 'fichas', label: 'Mundo', icon: Earth, words: 'fichas personagens lugares wiki enciclopédia' },
      { view: 'relacoes', label: 'Ligações', icon: Network, inside: 'fichas', words: 'relações grafo árvore da família parentes' },
      { view: 'timeline', label: 'Linha do tempo', icon: CalendarRange, inside: 'fichas', words: 'timeline eventos calendário eras idades' },
      { view: 'atlas', label: 'Mapas', icon: MapIcon, inside: 'fichas', words: 'atlas lugares marcadores caminho' },
      { view: 'tramas', label: 'Trama', icon: Sprout, words: 'pistas e mistérios tramas sementes setup payoff' },
      { view: 'conhecimento', label: 'Quem sabe o quê', icon: Lightbulb, inside: 'tramas', words: 'conhecimento segredos fatos' },
    ],
  },
  // A wiki como área própria só num mundo (nos outros tipos ela sai do Mundo e de Publicar).
  { group: '', items: [{ view: 'wiki', label: 'Wiki', icon: Globe, words: 'wiki site exportar baixar publicar enciclopédia' }] },
  { group: '', items: [{ view: 'rpg', label: 'Mesa', icon: Dices, words: 'rpg mesa de rpg campanha sessões dados codex grupo jogadores' }] },
]

/** Ferramentas, no fim do menu (a Oficina tem um cartão próprio). */
export const TOOLS: NavItem[] = [
  { view: 'inbox', label: 'Ideias', icon: Inbox, words: 'inbox caixa de entrada anotações captura' },
  { view: 'archivist', label: 'Perguntar ao mundo', icon: MessageCircleQuestion, words: 'archivist ia inteligência artificial pergunta' },
  { view: 'oficina', label: 'Oficina', icon: GraduationCap, words: 'dicas escrita gêneros exercícios curiosidades aprender' },
]

export const CONFIG_ITEM: NavItem = { view: 'config', label: 'Ajustes e dados', icon: Settings, words: 'configurações preferências backup' }

/** Todas as áreas, na ordem do menu. */
export const ALL_ITEMS: NavItem[] = [...NAV.flatMap((g) => g.items), ...TOOLS, CONFIG_ITEM]

/** Atalhos da barra de baixo no celular, se a pessoa não escolher outros. */
export const DEFAULT_SHORTCUTS: View[] = ['inicio', 'escrever', 'fichas', 'tramas']
