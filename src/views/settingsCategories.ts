import { BookDown, Cloud, Feather, Globe, HardDrive, History, LayoutGrid, Palette, PanelLeft, Server, type LucideIcon } from 'lucide-react'
import { fold } from '../logic/text'

export type SettingsCategory = 'universo' | 'dados' | 'historico' | 'livros' | 'aparencia' | 'escrita' | 'menu' | 'ferramentas' | 'conta' | 'servidor'

/** Para quem cada ajuste vale: este universo, este aparelho ou a conta (e o avançado, fechado). */
export type SettingsGroup = 'universo' | 'aparelho' | 'conta' | 'avancado'

export const SETTINGS_GROUPS: { id: SettingsGroup; label: string }[] = [
  { id: 'universo', label: 'Este universo' },
  { id: 'aparelho', label: 'Este aparelho' },
  { id: 'conta', label: 'Sua conta' },
  { id: 'avancado', label: 'Avançado' },
]

/** Categorias dos Ajustes. As palavras ajudam a busca a achar o que a pessoa procura; `scope` diz para quem vale. */
export const SETTINGS_CATEGORIES: { id: SettingsCategory; label: string; icon: LucideIcon; group: SettingsGroup; scope: string; words: string }[] = [
  {
    id: 'universo',
    label: 'Universo',
    icon: Globe,
    group: 'universo',
    scope: 'Vale só para este universo.',
    words: 'nome descrição capa tipo escrita campanha ano rótulo calendário meses dias meta palavras prazo e se ramo realidade alternativa campos sugeridos ficha modelo nomes ignorados apagar excluir deletar remover perigo',
  },
  {
    id: 'dados',
    label: 'Dados e backup',
    icon: HardDrive,
    group: 'universo',
    scope: 'Vale para este universo, neste navegador.',
    words: 'backup baixar importar json pasta computador snapshot armazenamento salvar imagens fotos espaço limpar',
  },
  { id: 'historico', label: 'Lixeira e histórico', icon: History, group: 'universo', scope: 'Vale só para este universo.', words: 'lixeira apagado recuperar desfazer histórico mudanças quem mudou voltar versão anterior' },
  {
    id: 'livros',
    label: 'Importar e wiki',
    icon: BookDown,
    group: 'universo',
    scope: 'Vale só para este universo.',
    words: 'livro importar docx word markdown txt capítulos wiki site jogadores html exportar baixar epub pdf',
  },
  { id: 'aparencia', label: 'Aparência', icon: Palette, group: 'aparelho', scope: 'Vale para este aparelho, em todos os universos.', words: 'tema claro escuro cor cores destaque fonte letra tamanho largura página visual' },
  {
    id: 'escrita',
    label: 'Escrita',
    icon: Feather,
    group: 'aparelho',
    scope: 'Vale para este aparelho, em todos os universos.',
    words: 'destacar nomes detecção margem barra formatação continuidade perguntas editor máquina de escrever parágrafo som',
  },
  {
    id: 'menu',
    label: 'Menu e ajuda',
    icon: PanelLeft,
    group: 'aparelho',
    scope: 'Vale para este aparelho, em todos os universos do mesmo tipo.',
    words: 'menu áreas esconder mostrar tour tutorial atalhos teclado ajuda versão',
  },
  {
    id: 'ferramentas',
    label: 'Todas as ferramentas',
    icon: LayoutGrid,
    group: 'aparelho',
    scope: 'Uma lista de tudo o que o Papirus tem, para achar uma função.',
    words: 'ferramentas funções áreas onde fica achar encontrar lista tudo mais menu recursos o que faz',
  },
  { id: 'conta', label: 'Conta', icon: Cloud, group: 'conta', scope: 'Vale para a sua conta, em todos os aparelhos.', words: 'conta login entrar sair nuvem sincronizar aparelhos' },
  {
    id: 'servidor',
    label: 'Servidor próprio',
    icon: Server,
    group: 'avancado',
    scope: 'Vale para este aparelho. Só precisa disto quem hospeda o próprio Papirus.',
    words: 'servidor supabase sql chave endereço codex ao vivo jogadores link hospedar',
  },
]

/** Nomes antigos de categorias (links e o que ficou guardado) para os de agora. */
export function categoryFrom(id: string | null | undefined): SettingsCategory | null {
  if (id === 'perigo') return 'universo'
  return SETTINGS_CATEGORIES.some((c) => c.id === id) ? (id as SettingsCategory) : null
}

export const matches = (c: (typeof SETTINGS_CATEGORIES)[number], query: string) => {
  const q = fold(query.trim())
  return !q || fold(`${c.label} ${c.words}`).includes(q)
}
