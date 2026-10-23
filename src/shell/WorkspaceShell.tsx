import { ArrowLeftRight, ChevronsLeft, ChevronsRight, Moon, Sun, Inbox, Library as LibraryIcon, Menu, Search, Settings } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withDailyStart } from '../logic/stats'
import type { Universe } from '../model/schema'
import type { Library } from '../persistence/repository'
import { downloadText, fileNameFor } from '../export/download'
import { useFolderSync } from '../persistence/useFolderSync'
import { useUniverse, type SaveStatus } from '../persistence/useUniverse'
import { recall, remember, type usePrefs } from '../state/prefs'
import { WorkspaceContext, type Nav, type ToastOptions, type View, type Workspace } from '../state/workspace'
import { useMediaQuery } from '../ui/useMediaQuery'
import { useCodexSync } from '../share/useCodexSync'
import { isSample } from '../model/sample'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { Tour } from './Tour'
import { useCloudPush } from '../account/useCloud'
import { Brand } from './Brand'
import { NAV, type NavItem } from './nav'
import { CaptureDialog } from './CaptureDialog'
import { PeekDrawer } from './PeekDrawer'
import { SearchPalette } from './SearchPalette'
import { modKey } from '../ui/keys'

const HomeView = lazy(() => import('../views/HomeView'))
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
const ArchivistView = lazy(() => import('../views/ArchivistView'))
const SettingsView = lazy(() => import('../views/SettingsView'))

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
  const folder = useFolderSync(library, repo, universe, status)
  useCodexSync(universe, prefs)
  const [accountOpen, setAccountOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  // Primeira vez num universo: o tour começa sozinho (dá para pular e refazer).
  useEffect(() => {
    if (prefs.tourDone) return
    const t = setTimeout(() => setTourOpen(true), 700)
    return () => clearTimeout(t)
  }, [prefs.tourDone])
  const [nav, setNav] = useState<Nav>(() => ({ view: (recall(`vista:${initial.id}`) as View) || 'inicio' }))
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
  useCloudPush(library, universe, status, (copy) =>
    toast(`Este universo também mudou em outro aparelho. A versão de lá foi guardada como “${copy}”.`, { tone: 'erro' }),
  )

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

  const markBackup = useCallback(
    (changes: { last?: string; snoozeUntil?: string }) =>
      setPref('backups', { ...prefs.backups, [initial.id]: { ...prefs.backups[initial.id], ...changes } }),
    [prefs.backups, initial.id, setPref],
  )

  const downloadBackup = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    downloadText(fileNameFor(`${universe.name}-backup-${date}`, 'json'), JSON.stringify(repo.toFile(universe), null, 2), 'application/json')
    markBackup({ last: new Date().toISOString() })
  }, [universe, repo, markBackup])

  // Momento de abertura do universo: o lembrete é avaliado uma vez por visita.
  const [openedAt] = useState(() => Date.now())
  // Lembrete de backup: universo com conteúdo, sem backup há 7 dias e sem pasta sincronizada.
  const backupInfo = prefs.backups[initial.id] ?? {}
  const lastBackup = Date.parse(backupInfo.last ?? universe.createdAt)
  const hasContent = universe.scenes.some((s) => s.text.trim()) || universe.entities.length > 0
  const needsBackup =
    hasContent &&
    folder.state !== 'ok' &&
    folder.state !== 'escrevendo' &&
    openedAt - lastBackup > 7 * 24 * 3600 * 1000 &&
    (!backupInfo.snoozeUntil || openedAt > Date.parse(backupInfo.snoozeUntil))

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
      startTour: () => setTourOpen(true),
      folder,
      downloadBackup,
    }),
    [universe, update, status, flush, repo, library, prefs, setPref, nav, go, toast, undoable, onClose, folder, downloadBackup],
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
  // Em telas médias (tablet), o menu começa recolhido para sobrar espaço para o texto.
  const medium = useMediaQuery('(min-width: 761px) and (max-width: 1180px)')
  const [mediumOpen, setMediumOpen] = useState(false)
  const collapsed = medium ? !mediumOpen : prefs.railCollapsed
  const phone = useMediaQuery('(max-width: 760px)')
  const allItems: NavItem[] = [...NAV.flatMap((g) => g.items), { view: 'inbox', label: 'Inbox', icon: Inbox }, { view: 'config', label: 'Ajustes e dados', icon: Settings }]
  const visibleItems = allItems.filter((item) => item.view === 'config' || !prefs.hiddenViews.includes(item.view) || nav.view === item.view)

  return (
    <WorkspaceContext.Provider value={ws}>
      <div className={`shell${collapsed ? ' rail-collapsed' : ''}`} data-view={nav.view}>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {phone ? (
          <PhoneNav
            items={visibleItems}
            current={nav.view}
            inboxCount={openInbox}
            universeName={universe.name}
            onGo={go}
            onSearch={() => setSearchOpen(true)}
            onLibrary={() => void ws.closeUniverse()}
          />
        ) : (
        <nav className="rail" aria-label="Áreas" data-tour="menu">
          <div className="rail-top">
            <button type="button" className="rail-brand" title="Trocar de universo" onClick={() => void ws.closeUniverse()}>
              <Brand compact={collapsed} />
            </button>
            <button
              type="button"
              className="rail-universe"
              title="Trocar de universo"
              aria-label={`${universe.name || 'Sem nome'}: trocar de universo`}
              data-tour="universos"
              onClick={() => void ws.closeUniverse()}
            >
              <LibraryIcon size={14} aria-hidden="true" />
              <span className="rail-label rail-universe-name">{universe.name || 'Sem nome'}</span>
              <ArrowLeftRight size={13} aria-hidden="true" className="rail-label rail-universe-switch" />
            </button>
          </div>

          <button type="button" className="rail-search" data-tour="busca" aria-label="Buscar" title="Buscar" onClick={() => setSearchOpen(true)}>
            <Search size={16} aria-hidden="true" />
            <span className="rail-label">Buscar</span>
            <kbd className="kbd rail-label">{modKey} K</kbd>
          </button>

          <div className="rail-groups">
            {NAV.map((g) => {
              // Áreas escondidas somem do menu, mas a aberta continua visível.
              const items = g.items.filter((item) => !prefs.hiddenViews.includes(item.view) || nav.view === item.view)
              if (!items.length) return null
              return (
                <div key={g.group} className="rail-group">
                  {g.group && <span className="rail-group-label rail-label">{g.group}</span>}
                  {items.map((item) => (
                    <RailButton key={item.view} item={item} active={nav.view === item.view} onClick={() => go(item.view)} />
                  ))}
                </div>
              )
            })}
            <div className="rail-group rail-group-end">
              {(!prefs.hiddenViews.includes('inbox') || nav.view === 'inbox') && (
                <RailButton
                  item={{ view: 'inbox', label: 'Inbox', icon: Inbox }}
                  active={nav.view === 'inbox'}
                  badge={openInbox || undefined}
                  onClick={() => go('inbox')}
                />
              )}
              <RailButton
                item={{ view: 'config', label: 'Ajustes e dados', icon: Settings }}
                active={nav.view === 'config'}
                onClick={() => go('config')}
              />
            </div>
          </div>

          <div className="rail-bottom">
            <AccountButton compact={collapsed} onClick={() => setAccountOpen(true)} />
            <ThemeToggle prefs={prefs} setPref={setPref} />
            <span className="save-status" data-tour="salvo" role="status" data-status={status} title={STATUS_LABEL[status]}>
              <span className="save-dot" aria-hidden="true" />
              <span className="rail-label">{STATUS_LABEL[status]}</span>
            </span>
            <button
              type="button"
              className="btn-icon rail-collapse"
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              onClick={() => (medium ? setMediumOpen(collapsed) : setPref('railCollapsed', !collapsed))}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </div>
        </nav>
        )}

        <main id="conteudo" className="stage" tabIndex={-1}>
          {isSample(universe) && (
            <div className="sample-banner" role="status">
              <span>
                <strong>Você está no mundo de exemplo.</strong> Mexa à vontade: nada aqui é seu de verdade.
              </span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void ws.closeUniverse()}>
                Criar o meu universo
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void ws.closeUniverse()}>
                Sair do exemplo
              </button>
            </div>
          )}
          {needsBackup && (
            <div className="backup-banner" role="status">
              <span>
                Faz {Math.floor((openedAt - lastBackup) / 86400000)} dias sem backup de “{universe.name}”. Tudo está só neste navegador.
              </span>
              <button type="button" className="btn btn-sm btn-primary" onClick={downloadBackup}>
                Baixar backup
              </button>
              {folder.supported && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void folder.connect()}>
                  Salvar numa pasta
                </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => markBackup({ snoozeUntil: new Date(Date.now() + 3 * 86400000).toISOString() })}>
                Lembrar em 3 dias
              </button>
            </div>
          )}
          {folder.state === 'pendente' && (
            <div className="backup-banner" role="status">
              <span>O navegador pede permissão de novo para salvar na pasta “{folder.name}”.</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void folder.reconnect()}>
                Reconectar pasta
              </button>
            </div>
          )}
          <Suspense fallback={<div className="view-loading">Carregando…</div>}>
            <ViewSwitch view={nav.view} navId={nav.id ?? null} onOpenOther={onOpenOther} />
          </Suspense>
        </main>

        {peekId && <PeekDrawer entityId={peekId} onClose={() => setPeekId(null)} />}
        {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
        {tourOpen && (
          <Tour
            onGo={go}
            onClose={() => {
              setTourOpen(false)
              setPref('tourDone', true)
            }}
          />
        )}
        {accountOpen && <AccountDialog library={library} prefs={prefs} setPref={setPref} onClose={() => setAccountOpen(false)} />}
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
    <button
      type="button"
      className="rail-item"
      data-tour={`nav-${item.view}`}
      aria-current={active ? 'page' : undefined}
      aria-label={badge ? `${item.label} (${badge})` : item.label}
      title={item.label}
      onClick={onClick}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="rail-label">{item.label}</span>
      {badge !== undefined && (
        <span className="rail-badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  )
}

function ViewSwitch({ view, navId, onOpenOther }: { view: View; navId: string | null; onOpenOther: (u: Universe) => void }) {
  switch (view) {
    case 'inicio':
      return <HomeView />
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
    case 'archivist':
      return <ArchivistView />
    case 'config':
      // A categoria pedida (ex.: "conta") abre os Ajustes já nela.
      return <SettingsView key={navId ?? ''} onOpenOther={onOpenOther} />
  }
}

/** Menu do celular: busca, as primeiras áreas e "Mais" com todas. */
function PhoneNav({
  items,
  current,
  inboxCount,
  universeName,
  onGo,
  onSearch,
  onLibrary,
}: {
  items: NavItem[]
  current: View
  inboxCount: number
  universeName: string
  onGo: (v: View) => void
  onSearch: () => void
  onLibrary: () => void
}) {
  const [open, setOpen] = useState(false)
  // A área aberta sempre aparece entre os atalhos.
  const first = items.slice(0, 4)
  const shortcuts = first.some((i) => i.view === current) ? first : [...items.slice(0, 3), ...items.filter((i) => i.view === current)]
  const choose = (v: View) => {
    setOpen(false)
    onGo(v)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav className="rail rail-phone" aria-label="Áreas" data-tour="menu">
      <button type="button" className="rail-item" title="Buscar" aria-label="Buscar" onClick={onSearch}>
        <Search size={18} aria-hidden="true" />
      </button>
      {shortcuts.map((item) => (
        <RailButton key={item.view} item={item} active={current === item.view} badge={item.view === 'inbox' && inboxCount ? inboxCount : undefined} onClick={() => choose(item.view)} />
      ))}
      <button type="button" className="rail-item" aria-expanded={open} aria-controls="menu-mais" aria-label="Mais" title="Mais áreas" onClick={() => setOpen(!open)}>
        <Menu size={18} aria-hidden="true" />
        <span className="rail-more-label">Mais</span>
        {inboxCount > 0 && !shortcuts.some((i) => i.view === 'inbox') && <span className="rail-badge" aria-hidden="true" />}
      </button>
      {open && (
        <>
          <div className="rail-more-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <div id="menu-mais" className="rail-more" role="group" aria-label="Todas as áreas">
            <button type="button" className="rail-more-universe" onClick={onLibrary}>
              <LibraryIcon size={16} aria-hidden="true" /> <span>{universeName || 'Sem nome'}</span> <span className="muted tiny">trocar</span>
            </button>
            <div className="rail-more-grid">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.view} type="button" className="rail-more-item" aria-current={current === item.view ? 'page' : undefined} onClick={() => choose(item.view)}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.view === 'inbox' && inboxCount > 0 && <span className="rail-badge">{inboxCount}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </nav>
  )
}

/** Troca claro/escuro na hora, sem ir aos Ajustes. */
function ThemeToggle({ prefs, setPref }: { prefs: Workspace['prefs']; setPref: Workspace['setPref'] }) {
  const dark = prefs.theme === 'escuro' || (prefs.theme === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <button
      type="button"
      className="btn-icon rail-theme"
      data-tour="tema"
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setPref('theme', dark ? 'claro' : 'escuro')}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
