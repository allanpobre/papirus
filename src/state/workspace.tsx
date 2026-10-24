import { createContext, useContext } from 'react'
import type { Universe } from '../model/schema'
import type { Library, UniverseRepository } from '../persistence/repository'
import type { FolderSync } from '../persistence/useFolderSync'
import type { SaveStatus } from '../persistence/useUniverse'
import type { LiveSource, Presence } from '../share/useLiveSync'
import type { Prefs } from './prefs'

export type View =
  | 'inicio'
  | 'escrever'
  | 'livro'
  | 'fichas'
  | 'relacoes'
  | 'timeline'
  | 'atlas'
  | 'tramas'
  | 'conhecimento'
  | 'organizar'
  | 'archivist'
  | 'rpg'
  | 'inbox'
  | 'config'

export interface Nav {
  view: View
  /** Registro aberto na vista (ficha, cena, sessão…). */
  id?: string | null
}

export interface ToastOptions {
  /** Ação oferecida no aviso, como "Desfazer". */
  action?: { label: string; run: () => void }
  tone?: 'info' | 'erro'
}

export interface Workspace {
  universe: Universe
  update: (change: (u: Universe) => Universe) => void
  status: SaveStatus
  flush: () => Promise<void>
  repo: UniverseRepository
  library: Library
  prefs: Prefs
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  nav: Nav
  go: (view: View, id?: string | null) => void
  /** Mostra o resumo de uma ficha num painel lateral, sem sair do lugar. */
  peek: (entityId: string | null) => void
  toast: (message: string, options?: ToastOptions) => void
  /**
   * Aplica uma mudança e oferece "Desfazer" por alguns segundos.
   * O desfazer restaura o universo inteiro de antes da mudança.
   */
  undoable: (message: string, change: (u: Universe) => Universe) => void
  closeUniverse: () => void
  /** Cópia do universo numa pasta do computador. */
  folder: FolderSync
  /** Baixa o backup completo em JSON e registra a data. */
  downloadBackup: () => void
  openCapture: () => void
  openSearch: () => void
  /** Abre o tour guiado pela tela. */
  startTour: () => void
  /** De onde veio o universo: deste navegador, compartilhado por alguém ou pelo link de leitura. */
  source: LiveSource
  /** Só leitura: nada pode ser mudado (o servidor também não aceitaria). */
  readOnly: boolean
  /** Outras pessoas com este universo aberto agora. */
  others: Presence[]
  /** Muda quando o texto de uma cena chega de fora, para o editor recarregar. */
  remoteRev: Record<string, number>
  setEditingScene: (sceneId: string | null) => void
  /** Abre a janela de compartilhar este universo. */
  openShare: () => void
  /** Abre o modo leitor (o livro com o caderno sem spoiler). */
  openReader: () => void
  /** Abre a diagramação do livro (PDF para imprimir). */
  openBookDesigner: () => void
}

export const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext)
  if (!ws) throw new Error('useWorkspace fora do WorkspaceContext')
  return ws
}
