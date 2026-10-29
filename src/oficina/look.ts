import { Activity, Coffee, Compass, Crown, Ghost, Heart, Layers, MessagesSquare, PenLine, Rocket, Scissors, Search, UserRound, Wand2, type LucideIcon } from 'lucide-react'
import type { GuideId, GuideSection } from './guides'

/** Cor e ícone de cada gênero (a capa da Oficina e o topo de cada guia). */
export const LOOK: Record<GuideId, { icon: LucideIcon; color: string }> = {
  fundamentos: { icon: PenLine, color: '#1d6b58' },
  fantasia: { icon: Wand2, color: '#7b5ea7' },
  ficcao: { icon: Rocket, color: '#2f6fae' },
  misterio: { icon: Search, color: '#4a5260' },
  romance: { icon: Heart, color: '#c0577a' },
  terror: { icon: Ghost, color: '#8a2f3b' },
  realismo: { icon: Coffee, color: '#a5762a' },
  personagem: { icon: UserRound, color: '#b8613c' },
  estrutura: { icon: Layers, color: '#3f6e9a' },
  dialogo: { icon: MessagesSquare, color: '#21857a' },
  ritmo: { icon: Activity, color: '#b0801a' },
  revisao: { icon: Scissors, color: '#6a5aa8' },
  mestrar: { icon: Crown, color: '#b81d3c' },
  aventuras: { icon: Compass, color: '#3d7a3a' },
}

/** As prateleiras, na ordem da capa, com o que cada uma oferece. */
export const SECTIONS: { id: GuideSection; title: string; lede: string }[] = [
  { id: 'genero', title: 'Gêneros', lede: 'O que cada tipo de história promete ao leitor.' },
  { id: 'tecnica', title: 'Técnicas', lede: 'Ferramentas que valem para qualquer gênero.' },
  { id: 'mestre', title: 'Para mestres de RPG', lede: 'Preparar, conduzir e surpreender a mesa.' },
]
