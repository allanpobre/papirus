import { ArrowLeftRight, BookOpen, ChevronsLeft, ChevronsRight, Eye, Moon, Sun, Inbox, Library as LibraryIcon, Menu, Search, Settings, Users, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { withDailyStart } from '../logic/stats'
import { purgeTrash, track } from '../logic/history'
import { addBook, shelf } from '../export/shelf'
import { useAccount } from '../account/auth'
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
import { wordsToday } from '../logic/stats'
import { recordToday } from '../social/dailyWords'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { Tour } from './Tour'
import { isReadOnly, useLiveSync, type LiveSource } from '../share/useLiveSync'
import { ShareDialog } from '../share/ShareDialog'
import { useReadOnlyInputs } from './useReadOnlyInputs'
import { shortName } from '../share/sharing'
import { readerCopy } from '../share/readerCopy'
import { ReaderView } from '../reader/ReaderView'
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
const BookView = lazy(() => import('../views/BookView'))
const BookDesigner = lazy(() => import('../book/BookDesigner'))

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
  /** Universo de outra pessoa ou aberto pelo link de leitura. Padrão: deste navegador. */
  source?: LiveSource
}

const OWN: LiveSource = { kind: 'proprio' }

interface ToastItem extends ToastOptions {
  id: number
  message: string
}

export function WorkspaceShell({ library, initial, recovered, prefsApi, onClose, onOpenOther, source = OWN }: Props) {
  const { universe, status, update: write, flush, repo } = useUniverse(library, initial, recovered)
  const readOnly = isReadOnly(source)
  const [shareOpen, setShareOpen] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState<string | null>(null)
  const closeBook = useCallback(() => setBookOpen(null), [])
  const [sampleNoteClosed, setSampleNoteClosed] = useState(() => recall('exemplo-aviso') === 'fechado')
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [remoteRev, setRemoteRev] = useState<Record<string, number>>({})
  const { prefs, setPref } = prefsApi
  const folder = useFolderSync(library, repo, universe, status)
  useCodexSync(universe, prefs)
  // Palavras de hoje deste universo, para os desafios de escrita (somam todos os universos).
  useEffect(() => {
    if (readOnly) return
    const t = setTimeout(() => recordToday(universe.id, wordsToday(universe)), 1500)
    return () => clearTimeout(t)
  }, [universe, readOnly])
  const [accountOpen, setAccountOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  // Primeira vez num universo: o tour começa sozinho (dá para pular e refazer).
  useEffect(() => {
    if (prefs.tourDone || source.kind !== 'proprio') return
    const t = setTimeout(() => setTourOpen(true), 700)
    return () => clearTimeout(t)
  }, [prefs.tourDone, source.kind])
  const [nav, setNav] = useState<Nav>(() => ({ view: (recall(`vista:${initial.id}`) as View) || 'inicio' }))
  const [peekId, setPeekId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const toastSeq = useRef(0)

  // Registra o total de palavras no início do dia, para a meta diária.
  useEffect(() => {
    if (!readOnly) write((u) => purgeTrash(withDailyStart(u)))
  }, [write, readOnly])

  // Repetir uma nova tentativa de salvar se a anterior falhou.
  useEffect(() => {
    if (status !== 'erro') return
    const t = setTimeout(() => {
      write((u) => ({ ...u }))
    }, 5000)
    return () => clearTimeout(t)
  }, [status, write])

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

  // Só leitura: nenhuma mudança passa (e um aviso explica, no máximo a cada poucos segundos).
  const lastBlocked = useRef(0)
  // Cada mudança feita aqui passa pela lixeira e pelo histórico, com o nome de quem fez.
  const account = useAccount()
  const me = useRef<string | null>(null)
  useEffect(() => {
    me.current = account.user?.email ? shortName(account.user.email) : null
  }, [account.user?.email])
  const tracked = useCallback((change: (u: Universe) => Universe) => write((u) => track(u, change(u), me.current)), [write])
  const update = useMemo(() => {
    if (!readOnly) return tracked
    return () => {
      if (Date.now() - lastBlocked.current < 4000) return
      lastBlocked.current = Date.now()
      toast(source.kind === 'link' ? 'Você está lendo pelo link: aqui nada pode ser mudado.' : 'Este universo foi compartilhado só para ver. Peça a quem é dono para poder editar.')
    }
  }, [readOnly, tracked, toast, source.kind])
  useReadOnlyInputs(readOnly)

  const applyRemote = useCallback(
    (next: Universe, changedScenes: string[]) => {
      write(() => next)
      if (changedScenes.length)
        setRemoteRev((r) => {
          const out = { ...r }
          for (const id of changedScenes) out[id] = (out[id] ?? 0) + 1
          return out
        })
    },
    [write],
  )
  const others = useLiveSync({
    lib: library,
    universe,
    status,
    source,
    sceneId: editingScene,
    applyRemote,
    notify: (message, tone) => toast(message, { tone }),
  })

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
    source.kind === 'proprio' &&
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
      source,
      readOnly,
      others,
      remoteRev,
      setEditingScene,
      openShare: () => setShareOpen(true),
      openReader: () => setReaderOpen(true),
      openBookDesigner: (bookId?: string) => {
        // Sem livro escolhido: o primeiro da estante, ou um novo.
        let id = bookId ?? shelf(universe)[0]?.id
        if (!id)
          update((u) => {
            const [next, b] = addBook(u)
            id = b.id
            return next
          })
        setBookOpen(id ?? null)
      },
    }),
    [universe, update, status, flush, repo, library, prefs, setPref, nav, go, toast, undoable, onClose, folder, downloadBackup, source, readOnly, others, remoteRev],
  )

  // Arrastar texto selecionado sem querer inicia o "arrastar e soltar" do navegador, e alguns
  // visualizadores (como o app do Claude) cobrem a tela com uma camada de soltar arquivo.
  // Só o editor e o que é arrastável de propósito podem arrastar.
  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement
      if (el?.closest('.ProseMirror, [draggable="true"]')) return
      e.preventDefault()
    }
    document.addEventListener('dragstart', onDragStart, true)
    return () => document.removeEventListener('dragstart', onDragStart, true)
  }, [])

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
      <div className={`shell${collapsed ? ' rail-collapsed' : ''}`} data-view={nav.view} inert={readerOpen || bookOpen !== null || undefined}>
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
            {others.length > 0 && <OthersHere others={others} compact={collapsed} />}
            {source.kind === 'proprio' && (
              <button type="button" className="rail-item rail-share" data-tour="compartilhar" title="Compartilhar este universo" aria-label="Compartilhar" onClick={() => setShareOpen(true)}>
                <Users size={18} aria-hidden="true" />
                <span className="rail-label">Compartilhar</span>
              </button>
            )}
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
          {source.kind !== 'proprio' && <SharedBanner source={source} onLeave={() => void ws.closeUniverse()} onRead={() => setReaderOpen(true)} />}
          {isSample(universe) && !sampleNoteClosed && (
            <div className="sample-banner" role="status">
              <span className="sample-banner-text">
                <strong>Mundo de exemplo</strong>
                <span className="sample-banner-more"> · mexa à vontade, nada aqui é seu</span>
              </span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setReaderOpen(true)}>
                <BookOpen size={14} /> Ler como livro
              </button>
              <button type="button" className="btn btn-sm btn-ghost" aria-label="Sair do exemplo" onClick={() => void ws.closeUniverse()}>
                Sair
              </button>
              <button
                type="button"
                className="btn-icon btn-sm"
                aria-label="Esconder este aviso"
                title="Esconder este aviso"
                onClick={() => {
                  remember('exemplo-aviso', 'fechado')
                  setSampleNoteClosed(true)
                }}
              >
                <X size={14} />
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
        {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} onAccount={() => setAccountOpen(true)} />}

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
      {bookOpen !== null &&
        createPortal(
          <Suspense fallback={<div className="book-designer view-loading">Abrindo a diagramação…</div>}>
            <BookDesigner bookId={bookOpen} onClose={closeBook} />
          </Suspense>,
          document.body,
        )}
      {readerOpen &&
        createPortal(<ReaderOverlay universe={universe} preview={source.kind === 'proprio' || source.kind === 'editar'} onClose={() => setReaderOpen(false)} />, document.body)}
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
    case 'livro':
      return <BookView />
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

/** Faixa no topo de um universo de outra pessoa: de quem é e o que dá para fazer. */
function SharedBanner({ source, onLeave, onRead }: { source: LiveSource; onLeave: () => void; onRead: () => void }) {
  if (source.kind === 'proprio') return null
  const owner = shortName(source.ownerEmail) || 'outra pessoa'
  return (
    <div className={`shared-banner${source.kind === 'editar' ? ' shared-edit' : ''}`} role="status">
      {source.kind === 'editar' ? <Users size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      <span>
        {source.kind === 'editar' ? (
          <>
            Universo de <strong>{owner}</strong>. Você pode editar: as mudanças chegam para todos em segundos.
          </>
        ) : source.kind === 'ver' ? (
          <>
            Universo de <strong>{owner}</strong>, compartilhado com você <strong>só para ver</strong>.
          </>
        ) : (
          <>
            Você está lendo <strong>pelo link</strong>{source.ownerEmail ? <> de {owner}</> : null}. Nada aqui pode ser mudado.
          </>
        )}
      </span>
      <button type="button" className="btn btn-sm" onClick={onRead}>
        <BookOpen size={14} /> Ler como livro
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onLeave}>
        {source.kind === 'link' ? 'Abrir o Papirus' : 'Voltar aos meus universos'}
      </button>
    </div>
  )
}

/** O modo leitor por cima da área de trabalho. Para o autor, é a prévia do que o leitor vê. */
function ReaderOverlay({ universe, preview, onClose }: { universe: Universe; preview: boolean; onClose: () => void }) {
  const [copy] = useState(() => readerCopy(universe, false))
  return (
    <div className="leitor-overlay" role="dialog" aria-modal="true" aria-label="Modo leitor">
      <ReaderView
        universe={copy}
        storageKey={`leitor:${universe.id}:${preview ? 'previa' : 'leitura'}`}
        onClose={onClose}
        closeLabel={preview ? 'Voltar ao universo' : 'Fechar o modo leitor'}
        footer={
          preview ? (
            <p className="leitor-preview-note muted tiny">
              Prévia: é assim que um leitor vê, sem nada secreto. Para esconder um spoiler numa ficha, selecione o trecho e use “Revelar a partir de…”.
            </p>
          ) : undefined
        }
      />
    </div>
  )
}

/** Quem mais está com o universo aberto agora. */
function OthersHere({ others, compact }: { others: { key: string; who: string }[]; compact: boolean }) {
  const names = others.map((o) => o.who).join(', ')
  return (
    <span className="others-here" title={`Também aqui agora: ${names}`} aria-label={`Também aqui agora: ${names}`}>
      {others.slice(0, 3).map((o) => (
        <span key={o.key} className="others-avatar" aria-hidden="true">
          {o.who.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {!compact && <span className="rail-label others-names">{names}</span>}
    </span>
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
