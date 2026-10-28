import { BookOpen, Compass, Download, FilePlus2, History, Library, Lightbulb, Moon, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { fold } from '../logic/text'
import { addScene, draftEntity, insert, manuscriptOrder } from '../model/universe'
import type { Workspace } from '../state/workspace'
import { ALL_ITEMS } from './nav'

/** Uma ação do Ctrl+K: ir para uma área, criar algo, abrir uma ferramenta. */
export interface Command {
  id: string
  title: string
  /** Outras palavras que acham esta ação. */
  words: string
  icon: LucideIcon
  run: (ws: Workspace) => void
}

export function commands(ws: Workspace): Command[] {
  const out: Command[] = [
    ...ALL_ITEMS.filter((item) => item.view !== ws.nav.view).map((item) => ({
      id: `ir-${item.view}`,
      title: `Ir para ${item.label}`,
      words: `abrir área menu ${item.words ?? ''}`,
      icon: item.icon,
      run: (w: Workspace) => w.go(item.view),
    })),
  ]
  if (!ws.readOnly) {
    out.unshift(
      {
        id: 'nova-cena',
        title: 'Nova cena',
        words: 'criar escrever capítulo',
        icon: FilePlus2,
        run: (w) => {
          let id = ''
          w.update((u) => {
            const last = manuscriptOrder(u).at(-1)
            const [next, s] = addScene(u, last?.storyId ?? null)
            id = s.id
            return next
          })
          w.go('escrever', id)
        },
      },
      {
        id: 'nova-ficha',
        title: 'Nova ficha',
        words: 'criar personagem lugar facção',
        icon: UserPlus,
        run: (w) => {
          let id = ''
          w.update((u) => {
            const [next, e] = insert(u, 'entities', draftEntity('personagem', 'Nova ficha'))
            id = e.id
            return next
          })
          w.go('fichas', id)
        },
      },
      { id: 'ideia', title: 'Anotar uma ideia', words: 'inbox captura nota rápida', icon: Lightbulb, run: (w) => w.openCapture() },
    )
  }
  out.push(
    { id: 'leitor', title: ws.source.kind === 'proprio' || ws.source.kind === 'editar' ? 'Prévia do leitor' : 'Ler como livro', words: 'modo leitor livro caderno spoiler ler', icon: BookOpen, run: (w) => w.openReader() },
    ...(ws.readOnly ? [] : [{ id: 'livro', title: 'Diagramar o livro (PDF)', words: 'imprimir pdf capa fonte formatação exportar livro publicar diagramação', icon: BookOpen, run: (w: Workspace) => w.openBookDesigner() }]),
    { id: 'tema', title: ws.prefs.theme === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro', words: 'tema claro escuro aparência cor noite', icon: Moon, run: (w) => w.setPref('theme', w.prefs.theme === 'escuro' ? 'claro' : 'escuro') },
    { id: 'lixeira', title: 'Abrir a lixeira e o histórico', words: 'lixeira apagado recuperar histórico mudanças voltar', icon: History, run: (w) => w.go('config', 'historico') },
    { id: 'tour', title: 'Fazer o tour', words: 'ajuda tutorial guia', icon: Compass, run: (w) => w.startTour() },
    { id: 'universos', title: 'Trocar de universo', words: 'biblioteca sair voltar universos', icon: Library, run: (w) => w.closeUniverse() },
  )
  if (ws.source.kind === 'proprio') {
    out.push(
      { id: 'compartilhar', title: 'Compartilhar este universo', words: 'convidar link leitura pessoas editar', icon: Users, run: (w) => w.openShare() },
      { id: 'backup', title: 'Baixar backup', words: 'exportar json salvar cópia', icon: Download, run: (w) => w.downloadBackup() },
    )
  }
  return out
}

/** Ações que combinam com o que foi digitado (todas as palavras, sem acento). */
export function matchCommands(list: Command[], query: string): Command[] {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean)
  if (!words.length) return list.filter((c) => !c.id.startsWith('ir-')).slice(0, 6)
  return list.filter((c) => {
    const hay = fold(`${c.title} ${c.words}`)
    return words.every((w) => hay.includes(w))
  })
}
