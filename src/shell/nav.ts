import {
  BookMarked,
  BookOpenText,
  CalendarRange,
  Dices,
  Feather,
  GraduationCap,
  House,
  Lightbulb,
  MapIcon,
  Network,
  PanelsTopLeft,
  ScrollText,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import type { View } from '../state/workspace'

/** Áreas do menu lateral, em grupos. */
export interface NavItem {
  view: View
  label: string
  icon: LucideIcon
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ view: 'inicio', label: 'Início', icon: House }] },
  {
    group: 'Escrita',
    items: [
      { view: 'escrever', label: 'Escrever', icon: Feather },
      { view: 'livro', label: 'Livro', icon: BookOpenText },
    ],
  },
  {
    group: 'Mundo',
    items: [
      { view: 'fichas', label: 'Fichas', icon: BookMarked },
      { view: 'relacoes', label: 'Relações', icon: Network },
      { view: 'timeline', label: 'Timeline', icon: CalendarRange },
      { view: 'atlas', label: 'Atlas', icon: MapIcon },
    ],
  },
  {
    group: 'Narrativa',
    items: [
      { view: 'tramas', label: 'Tramas', icon: Sprout },
      { view: 'conhecimento', label: 'Conhecimento', icon: Lightbulb },
      { view: 'organizar', label: 'Organizar', icon: PanelsTopLeft },
      { view: 'archivist', label: 'Archivist', icon: ScrollText },
    ],
  },
  { group: 'Mesa', items: [{ view: 'rpg', label: 'RPG', icon: Dices }] },
  { group: 'Aprender', items: [{ view: 'oficina', label: 'Oficina', icon: GraduationCap }] },
]

