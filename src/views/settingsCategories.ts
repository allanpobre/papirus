import { BookDown, Cloud, Feather, Globe, HardDrive, History, Palette, PanelLeft, Trash2, type LucideIcon } from 'lucide-react'
import { fold } from '../logic/text'

export type SettingsCategory = 'aparencia' | 'universo' | 'escrita' | 'menu' | 'dados' | 'historico' | 'livros' | 'conta' | 'perigo'

/** Categorias dos Ajustes. As palavras ajudam a busca a achar o que a pessoa procura. */
export const SETTINGS_CATEGORIES: { id: SettingsCategory; label: string; icon: LucideIcon; words: string }[] = [
  { id: 'aparencia', label: 'Aparência', icon: Palette, words: 'tema claro escuro cor cores destaque fonte letra tamanho largura página visual' },
  { id: 'universo', label: 'Universo', icon: Globe, words: 'nome descrição ano rótulo calendário meses dias meta palavras e se ramo realidade alternativa campos sugeridos ficha modelo' },
  { id: 'escrita', label: 'Escrita', icon: Feather, words: 'destacar nomes detecção margem barra formatação continuidade perguntas editor' },
  { id: 'menu', label: 'Menu e ajuda', icon: PanelLeft, words: 'menu áreas esconder mostrar tour tutorial atalhos teclado ajuda' },
  { id: 'dados', label: 'Dados e backup', icon: HardDrive, words: 'backup baixar importar exportar json markdown pasta computador snapshot armazenamento salvar' },
  { id: 'historico', label: 'Lixeira e histórico', icon: History, words: 'lixeira apagado recuperar desfazer histórico mudanças quem mudou voltar versão anterior' },
  { id: 'livros', label: 'Livros e wiki', icon: BookDown, words: 'livro importar exportar word docx epub markdown capítulos wiki site jogadores html' },
  { id: 'conta', label: 'Conta e servidor', icon: Cloud, words: 'conta login entrar sair nuvem sincronizar servidor supabase codex ao vivo jogadores link' },
  { id: 'perigo', label: 'Apagar universo', icon: Trash2, words: 'apagar excluir deletar remover universo perigo' },
]

export const matches = (c: (typeof SETTINGS_CATEGORIES)[number], query: string) => {
  const q = fold(query.trim())
  return !q || fold(`${c.label} ${c.words}`).includes(q)
}
