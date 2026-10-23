import {
  BookMarked,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  Dices,
  Feather,
  Inbox,
  Library as LibraryIcon,
  Map as MapIcon,
  Network,
  PanelsTopLeft,
  Search,
  Settings,
  Sprout,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withDailyStart } from '../logic/stats'
import type { Universe } from '../model/schema'
import type { Library } from '../persistence/repository'
import { useUniverse, type SaveStatus } from '../persistence/useUniverse'
import { recall, remember, type usePrefs } from '../state/prefs'
import { WorkspaceContext, type Nav, type ToastOptions, type View, type Workspace } from '../state/workspace'
import { Brand } from './Brand'
import { CaptureDialog } from './CaptureDialog'
import { PeekDrawer } from './PeekDrawer'
import { SearchPalette } from './SearchPalette'
import { modKey } from '../ui/keys'

const WriteView = lazy(() => import('../views/write/WriteView'))
const EntitiesView = lazy(() => import('../views/EntitiesView'))
const GraphView = lazy(() => import('../views/GraphView'))
const TimelineView = lazy(() => import('../views/TimelineView'))
const AtlasView = lazy(() => import('../views/AtlasView'))
const SeedsView = lazy(() => import('../views/SeedsView'))
const KnowledgeView = lazy(() => import('../views/KnowledgeView'))
const OrganizeView = lazy(() => import('../views/OrganizeView'))
const RpgView = lazy(() => import('../views/rpg/RpgView'))
const InboxView = lazy(() => import('../views/InboxView'))
const SettingsView = lazy(() => import('../views/SettingsView'))

interface NavItem {
  view: View
  label: string
  icon: LucideIcon
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Escrita', items: [{ view: 'escrever', label: 'Escrever', icon: Feather }] },
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
    ],
  },
  { group: 'Mesa', items: [{ view: 'rpg', label: 'RPG', icon: Dices }] },
]

const STATUS_LABEL: Record<SaveStatus, string> = {
  salvo: 'Salvo',
  pendente: 'Alterações não salvas',
  salvando: 'Salvando…',
  erro: 'Erro ao salvar — tentando de novo',
}

interface Props {
  library: Library
  initial: Universe
  recovered: boolean
  prefsApi: ReturnType<typeof usePrefs>
  onClose: () => void
  onOpenOther: (u: Universe) => void
}

interface ToastItem extends ToastOptions {
  id: number
  message: string
}

export function WorkspaceShell({ library, initial, recovered, prefsApi, onClose, onOpenOther }: Props) {
  const { universe, status, update, flush, repo } = useUniverse(library, initial, recovered)
  const { prefs, setPref } = prefsApi
  const [nav, setNav] = useState<Nav>(() => ({ view: (recall(`vista:${initial.id}`) as View) || 'escrever' }))
  const [peekId, setPeekId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const toastSeq = useRef(0)

  // Registra o total de palavras no início do dia, para a meta diária.
  useEffect(() => {
    update(withDailyStart)
  }, [update])

  // Repetir uma nova tentativa de salvar se a anterior falhou.
  useEffect(() => {
    if (status !== 'erro') return
    const t = setTimeout(() => {
      update((u) => ({ ...u }))
    }, 5000)
    return () => clearTimeout(t)
  }, [status, update])

  const go = useCallback(
    (view: View, id: string | null = null) => {
      setNav({ view, id })
      remember(`vista:${initial.id}`, view)
    },
    [initial.id],
  )

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++toastSeq.current
    setToasts((t) => [...t.slice(-2), { id, message, ...options }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), options.action ? 7000 : 3500)
  }, [])

  const undoable = useCallback(
    (message: string, change: (u: Universe) => Universe) => {
      let before: Universe | undefined
      update((u) => {
        before = u
        return change(u)
      })
      toast(message, {
        action: {
          label: 'Desfazer',
          run: () => before && update(() => ({ ...before!, updatedAt: new Date().toISOString() })),
        },
      })
    },
    [update, toast],
  )

  const ws: Workspace = useMemo(
    () => ({
      universe,
      update,
      status,
      flush,
      repo,
      library,
      prefs,
      setPref,
      nav,
      go,
      peek: setPeekId,
      toast,
      undoable,
      closeUniverse: async () => {
        await flush()
        onClose()
      },
      openCapture: () => setCaptureOpen(true),
      openSearch: () => setSearchOpen(true),
    }),
    [universe, update, status, flush, repo, library, prefs, setPref, nav, go, toast, undoable, onClose],
  )

  // Atalhos globais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setCaptureOpen(true)
      } else if (mod && e.key.toLowerCase() === 's') {
        // O salvamento é automático; Ctrl+S só antecipa.
        e.preventDefault()
        void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  const openInbox = universe.inbox.filter((i) => i.status === 'aberto').length
  const collapsed = prefs.railCollapsed

  return (
    <WorkspaceContext.Provider value={ws}>
      <div className={`shell${collapsed ? ' rail-collapsed' : ''}`} data-view={nav.view}>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <nav className="rail" aria-label="Áreas">
          <div className="rail-top">
            <button type="button" className="rail-brand" title="Trocar de universo" onClick={() => void ws.closeUniverse()}>
              <Brand compact={collapsed} />
            </button>
            <button
              type="button"
              className="rail-universe"
              title="Trocar de universo"
              onClick={() => void ws.closeUniverse()}
            >
              <LibraryIcon size={14} aria-hidden="true" />
              <span className="rail-label">{universe.name || 'Sem nome'}</span>
            </button>
          </div>

          <button type="button" className="rail-search" onClick={() => setSearchOpen(true)}>
            <Search size={16} aria-hidden="true" />
            <span className="rail-label">Buscar</span>
            <kbd className="kbd rail-label">{modKey} K</kbd>
          </button>

          <div className="rail-groups">
            {NAV.map((g) => (
              <div key={g.group} className="rail-group">
                <span className="rail-group-label rail-label">{g.group}</span>
                {g.items.map((item) => (
                  <RailButton key={item.view} item={item} active={nav.view === item.view} onClick={() => go(item.view)} />
                ))}
              </div>
            ))}
            <div className="rail-group rail-group-end">
              <RailButton
                item={{ view: 'inbox', label: 'Inbox', icon: Inbox }}
                active={nav.view === 'inbox'}
                badge={openInbox || undefined}
                onClick={() => go('inbox')}
              />
              <RailButton
                item={{ view: 'config', label: 'Ajustes e dados', icon: Settings }}
                active={nav.view === 'config'}
                onClick={() => go('config')}
              />
            </div>
          </div>

          <div className="rail-bottom">
            <span className="save-status" role="status" data-status={status} title={STATUS_LABEL[status]}>
              <span className="save-dot" aria-hidden="true" />
              <span className="rail-label">{STATUS_LABEL[status]}</span>
            </span>
            <button
              type="button"
              className="btn-icon rail-collapse"
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              onClick={() => setPref('railCollapsed', !collapsed)}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </div>
        </nav>

        <main id="conteudo" className="stage" tabIndex={-1}>
          <Suspense fallback={<div className="view-loading">Carregando…</div>}>
            <ViewSwitch view={nav.view} onOpenOther={onOpenOther} />
          </Suspense>
        </main>

        {peekId && <PeekDrawer entityId={peekId} onClose={() => setPeekId(null)} />}
        {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
        {captureOpen && <CaptureDialog onClose={() => setCaptureOpen(false)} />}

        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.tone === 'erro' ? ' toast-error' : ''}`}>
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.action!.run()
                    setToasts((all) => all.filter((x) => x.id !== t.id))
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </WorkspaceContext.Provider>
  )
}

function RailButton({ item, active, onClick, badge }: { item: NavItem; active: boolean; onClick: () => void; badge?: number }) {
  const Icon = item.icon
  return (
    <button type="button" className="rail-item" aria-current={active ? 'page' : undefined} title={item.label} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span className="rail-label">{item.label}</span>
      {badge !== undefined && (
        <span className="rail-badge" aria-label={`${badge} itens`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function ViewSwitch({ view, onOpenOther }: { view: View; onOpenOther: (u: Universe) => void }) {
  switch (view) {
    case 'escrever':
      return <WriteView />
    case 'fichas':
      return <EntitiesView />
    case 'relacoes':
      return <GraphView />
    case 'timeline':
      return <TimelineView />
    case 'atlas':
      return <AtlasView />
    case 'tramas':
      return <SeedsView />
    case 'conhecimento':
      return <KnowledgeView />
    case 'organizar':
      return <OrganizeView />
    case 'rpg':
      return <RpgView />
    case 'inbox':
      return <InboxView />
    case 'config':
      return <SettingsView onOpenOther={onOpenOther} />
  }
}

