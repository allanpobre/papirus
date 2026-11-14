import type { View } from '../state/workspace'
import { ALL_ITEMS, type NavItem } from './nav'

/** Uma frase, em linguagem simples, do que cada área faz. Usada em Ajustes › Todas as ferramentas. */
export const TOOL_HINTS: Partial<Record<View, string>> = {
  inicio: 'O ponto de partida: continuar escrevendo, a meta do dia e o que falta no mundo.',
  escrever: 'Onde se escreve: a Página, a Revisão (nomes novos e perguntas) e a Estrutura.',
  organizar: 'O mapa da história: quadro de cenas, ritmo e quem aparece em cada cena.',
  livro: 'Montar o livro: capa, PDF, EPUB, Word, livro 3D e leitores beta.',
  fichas: 'Personagens, lugares e tudo do seu mundo, com resumo, ligações e o que é verdade ou segredo.',
  relacoes: 'O desenho de quem se liga a quem: família, amizades, rivalidades.',
  timeline: 'Os acontecimentos em ordem, com anos e eras.',
  atlas: 'Os mapas do mundo, com os lugares marcados.',
  wiki: 'A enciclopédia do seu mundo, pronta para baixar ou mandar por link.',
  tramas: 'Pistas e mistérios: o que foi plantado e ainda precisa ser resolvido.',
  conhecimento: 'Quem sabe o quê: o que cada personagem e o leitor sabem em cada ponto da história.',
  rpg: 'A Mesa de RPG: escudo do mestre, combate, dados e o Codex dos jogadores.',
  inbox: 'Anote de qualquer lugar e decida depois: vira cena, ficha ou fica guardada.',
  archivist: 'Pergunte ao seu mundo com IA, usando a sua chave. Ela só lê, nunca muda nada.',
  oficina: 'Aprender escrevendo: trilhas curtas, exercícios, treino e o caderno.',
  guia: 'Explica cada área e cada parte, com o passeio de cada tela.',
  config: 'Este universo (Simples ou Completo, calendário), este aparelho (aparência, backup) e a sua conta.',
}

/** Áreas que só aparecem no modo Completo. */
export const COMPLETE_ONLY: View[] = ['tramas', 'conhecimento']

export interface ToolRow {
  item: NavItem
  hint: string
  /** Por que não está no menu agora, se for o caso. */
  hiddenBecause: null | 'simples' | 'menu'
}

/** Todas as áreas com a frase de cada uma, e o motivo se estiverem fora do menu deste universo. */
export function allTools(hiddenViews: View[], simple: boolean): ToolRow[] {
  return ALL_ITEMS.map((item) => ({
    item,
    hint: TOOL_HINTS[item.view] ?? '',
    hiddenBecause: hiddenViews.includes(item.view) ? (simple && COMPLETE_ONLY.includes(item.view) ? 'simples' : 'menu') : null,
  }))
}
