import { ArrowLeft, ArrowLeftRight, BookOpen, Feather, ChevronsLeft, ChevronsRight, Eye, GraduationCap, Moon, Pin, Sun, Library as LibraryIcon, Menu, Search, Users, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { withDailyStart } from '../logic/stats'
import { purgeTrash, track } from '../logic/history'
import { addBook, shelf } from '../export/shelf'
import { authClient, useAccount } from '../account/auth'
import { syncedMap } from '../account/cloud'
import type { Scene, Universe } from '../model/schema'
import { addScene, draftInbox, insert, updateScene } from '../model/universe'
import type { Library } from '../persistence/repository'
import { downloadText, fileNameFor } from '../export/download'
import { useFolderSync } from '../persistence/useFolderSync'
import { useUniverse, type SaveStatus } from '../persistence/useUniverse'
import { recall, remember, type usePrefs } from '../state/prefs'
import { WorkspaceContext, type Nav, type ToastOptions, type View, type Workspace } from '../state/workspace'
import { useMediaQuery } from '../ui/useMediaQuery'
import { useCodexSync } from '../share/useCodexSync'
import { setOutsideSession } from '../rpg/sessionFocus'
import { sendToRoteiro } from '../rpg/sessionLife'
import { sceneFromTreino } from '../treino/sceneFromTreino'
import { useTableRolls } from '../share/useTableRolls'
import { isLocalOnly, isSample } from '../model/sample'
import { wordsToday } from '../logic/stats'
import { recordToday } from '../social/dailyWords'
import { progressToShare, shareProgress } from '../social/activity'
import { ShelfSync } from '../social/useShelfSync'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { Tour } from './Tour'
import { usePlay } from './usePlay'
import { backState, backTo, navigateTo, onBackNavigate } from './backStack'
import { useBackLayer } from '../ui/useBackLayer'
import { useImageSync } from '../images/useImageSync'
import { embeddedImages } from '../images/backup'
import { onSceneImageError } from '../editor/image'
import { OficinaPage } from '../oficina/OficinaPage'
import { guessGuide } from '../oficina/guides'
import { isReadOnly, useLiveSync, type LiveSource } from '../share/useLiveSync'
import { ShareDialog } from '../share/ShareDialog'
import { useReadOnlyInputs } from './useReadOnlyInputs'
import { shortName } from '../share/sharing'
import { readerCopy } from '../share/readerCopy'
import { ReaderView } from '../reader/ReaderView'
import type { SendComment } from '../reader/ReaderComment'
import { commentSender } from '../share/feedback'
import { Brand } from './Brand'
import { WritingGate } from './WritingGate'
import { MesaGate } from '../views/rpg/MesaGate'
import { useMesaSector } from '../rpg/useMesaSector'
import { mesaTheme } from '../rpg/themes'
import { firstView, hiddenViewsFor, mesaModeAfter, universeKind, CAMPAIGN_SHORTCUTS } from '../model/kind'
import { ALL_ITEMS, CONFIG_ITEM, DEFAULT_SHORTCUTS, NAV, TOOLS, type NavItem } from './nav'
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
  // A Oficina é uma página à parte, por cima da área de trabalho.
  const [oficinaOpen, setOficinaOpen] = useState(false)
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
    // Palavras do exemplo não contam para a meta nem para os desafios.
    if (readOnly || isLocalOnly(universe)) return
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
  const [nav, setNav] = useState<Nav>(() => {
    // Reaberto pelo Android (ou recarregado): volta para a mesma tela e o mesmo registro.
    const back = backState()
    if (back.u === initial.id && back.view && back.view !== 'oficina') return { view: back.view, id: back.id ?? null }
    const last = recall(`vista:${initial.id}`) as View | null
    return { view: last && last !== 'oficina' ? last : firstView(initial) }
  })
  const navRef = useRef(nav)
  // A tela em que o universo abriu (decide a animação de entrada).
  const [openedIn] = useState(nav.view)
  // O passo atual do histórico passa a ser este universo, nesta tela.
  useEffect(() => {
    navigateTo({ u: initial.id, view: navRef.current.view, id: navRef.current.id ?? null }, true)
  }, [initial.id])
  // "Voltar" do aparelho: a tela (e o registro) do passo anterior.
  useEffect(
    () =>
      onBackNavigate((st) => {
        if (st.u !== initial.id || !st.view) return
        const next = { view: st.view, id: st.id ?? null }
        navRef.current = next
        setNav(next)
        remember(`vista:${initial.id}`, st.view)
      }),
    [initial.id],
  )
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
    (view: View, id: string | null = null, options: { replace?: boolean } = {}) => {
      if (view === 'oficina') return setOficinaOpen(true)
      navigateTo({ u: initial.id, view, id }, options.replace)
      navRef.current = { view, id }
      setNav({ view, id })
      remember(`vista:${initial.id}`, view)
    },
    [initial.id],
  )
  // O tour passeia pelas telas sem encher o "voltar" de passos.
  const tourGo = useCallback((view: View) => go(view, null, { replace: true }), [go])
  const goBack = useCallback(
    (view: View, id: string | null = null) =>
      backTo({ u: initial.id, view, id }, () => {
        navRef.current = { view, id }
        setNav({ view, id })
      }),
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
  // Desafio do dia, meta e medalhas: comemora o que for novo.
  usePlay(universe, library, readOnly, prefs.celebrate, toast)
  // Meta do dia batida: os amigos ficam sabendo (uma vez por dia; dá para desligar no perfil).
  const goal = universe.settings.dailyWordGoal
  const userId = account.user?.id
  const accountServer = account.server
  useEffect(() => {
    if (!userId || !accountServer || !prefs.shareProgress || readOnly || isLocalOnly(universe)) return
    const t = setTimeout(() => {
      if (progressToShare(userId, goal)) void authClient(accountServer).then((sb) => shareProgress(sb, userId, goal)).catch(() => undefined)
    }, 3000)
    return () => clearTimeout(t)
  }, [universe, userId, accountServer, goal, prefs.shareProgress, readOnly])
  // Imagens: vêm do servidor da conta (ou do link de leitura) e, com conta, sobem sozinhas.
  useImageSync({
    universe,
    server: source.kind === 'link' ? source.server : accountServer,
    userId: userId ?? null,
    canUpload: !readOnly && !isLocalOnly(universe),
    onError: (m) => toast(m, { tone: 'erro' }),
    update: readOnly ? undefined : write,
  })
  // Erros ao colar ou arrastar imagem no texto da cena.
  useEffect(() => {
    onSceneImageError((m) => toast(m, { tone: 'erro' }))
  }, [toast])
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
  // Rolagens feitas pelos jogadores no Codex chegam aqui, vão para o registro e para a bandeja da mesa.
  useTableRolls(universe, prefs, tracked, !readOnly)

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
    const file = repo.toFile(universe)
    // As imagens vão dentro do arquivo: o backup sozinho basta para ter tudo de volta.
    void embeddedImages(universe)
      .catch(() => ({}))
      .then((images) =>
        downloadText(fileNameFor(`${universe.name}-backup-${date}`, 'json'), JSON.stringify(Object.keys(images).length ? { ...file, images } : file, null, 2), 'application/json'),
      )
    markBackup({ last: new Date().toISOString() })
  }, [universe, repo, markBackup])

  // Momento de abertura do universo: o lembrete é avaliado uma vez por visita.
  const [openedAt] = useState(() => Date.now())
  // Lembrete de backup: universo com conteúdo, sem backup há 7 dias e sem pasta sincronizada.
  const backupInfo = prefs.backups[initial.id] ?? {}
  const lastBackup = Date.parse(backupInfo.last ?? universe.createdAt)
  const hasContent = universe.scenes.some((s) => s.text.trim()) || universe.entities.length > 0
  // Na conta (já sincronizado), a cópia na nuvem é o backup.
  const inCloud = Boolean(account.user && syncedMap(account.user.id)[initial.id])
  const backupDue =
    source.kind === 'proprio' && !isLocalOnly(universe) && hasContent && !inCloud && folder.state !== 'ok' && folder.state !== 'escrevendo' && openedAt - lastBackup > 7 * 24 * 3600 * 1000
  const needsBackup = backupDue && !prefs.autoBackup && (!backupInfo.snoozeUntil || openedAt > Date.parse(backupInfo.snoozeUntil))
  // Backup automático: uma vez por semana, ao abrir, o arquivo baixa sozinho.
  const autoDone = useRef(false)
  useEffect(() => {
    if (!backupDue || !prefs.autoBackup || autoDone.current) return
    const t = setTimeout(() => {
      autoDone.current = true
      downloadBackup()
      toast('Backup da semana baixado (veja em Downloads).')
    }, 2500)
    return () => clearTimeout(t)
  }, [backupDue, prefs.autoBackup, downloadBackup, toast])

  const kind = universeKind(universe)
  // Num livro, a mesa também é um setor: ao entrar nela, o menu e o clima ficam de mesa até voltar à escrita.
  const [bookMesa, setBookMesa] = useState(() => {
    try {
      return nav.view === 'rpg' || (nav.view !== 'inicio' && sessionStorage.getItem(`papirus:setor-mesa:${initial.id}`) === '1')
    } catch {
      return nav.view === 'rpg'
    }
  })
  const [seenView, setSeenView] = useState(nav.view)
  if (seenView !== nav.view) {
    setSeenView(nav.view)
    setBookMesa(mesaModeAfter(bookMesa, nav.view))
  }
  useEffect(() => {
    try {
      if (bookMesa) sessionStorage.setItem(`papirus:setor-mesa:${initial.id}`, '1')
      else sessionStorage.removeItem(`papirus:setor-mesa:${initial.id}`)
    } catch {
      // Sem armazenamento: só não lembra depois de recarregar.
    }
  }, [bookMesa, initial.id])
  /** Menu, atalhos e clima de mesa: numa campanha sempre; num livro, enquanto estiver na mesa. */
  const mesaSector = kind === 'campanha' || bookMesa
  // Numa campanha, o universo inteiro fica no clima da mesa (o tema do grupo aberto).
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const campaignGroup = universe.groups.find((g) => g.id === recall(`rpg-grupo:${universe.id}`)) ?? universe.groups[0]
  const campaignSystem = campaignGroup?.systemId ? universe.systems.find((x) => x.id === campaignGroup.systemId) : undefined
  useMesaSector(mesaTheme(campaignGroup?.theme, campaignSystem?.name), prefs.theme === 'escuro' || (prefs.theme === 'sistema' && systemDark), mesaSector)
  const hidden = useMemo(() => hiddenViewsFor(universe, prefs.menus, prefs.hiddenViews), [universe, prefs.menus, prefs.hiddenViews])
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
      goBack,
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
      kind,
      hiddenViews: hidden,
      setHiddenViews: (views: View[]) => setPref('menus', { ...prefs.menus, [kind]: views }),
    }),
    [universe, update, status, flush, repo, library, prefs, setPref, nav, go, goBack, toast, undoable, onClose, folder, downloadBackup, source, readOnly, others, remoteRev, kind, hidden],
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
  // Uma sessão de RPG ao vivo: de qualquer área, um toque volta para ela.
  const liveSession = universe.sessions.find((x) => x.status === 'em-andamento')
  const visibleItems = ALL_ITEMS.filter((item) => !item.inside && (item.view === 'config' || !hidden.includes(item.view) || nav.view === item.view))
  // A área marcada no menu: o Mapa, por exemplo, fica dentro de Escrever.
  const area = ALL_ITEMS.find((item) => item.view === nav.view)?.inside ?? nav.view

  return (
    <WorkspaceContext.Provider value={ws}>
      <ShelfSync />
      <div className={`shell${collapsed ? ' rail-collapsed' : ''}`} data-view={nav.view} inert={readerOpen || oficinaOpen || bookOpen !== null || undefined}>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {phone ? (
          <PhoneNav
            items={visibleItems}
            current={area}
            inboxCount={openInbox}
            universeName={universe.name}
            onGo={go}
            shortcuts={mesaSector ? prefs.campaignShortcuts : prefs.phoneShortcuts}
            defaults={mesaSector ? CAMPAIGN_SHORTCUTS : DEFAULT_SHORTCUTS}
            onShortcuts={(v) => setPref(mesaSector ? 'campaignShortcuts' : 'phoneShortcuts', v)}
            onBackToWriting={kind === 'escrita' && bookMesa ? () => go('inicio') : undefined}
            onSearch={() => setSearchOpen(true)}
            onLibrary={() => void ws.closeUniverse()}
            onShare={source.kind === 'proprio' ? () => setShareOpen(true) : undefined}
            extras={
              <>
                <AccountButton onClick={() => setAccountOpen(true)} />
                <ThemeToggle prefs={prefs} setPref={setPref} />
              </>
            }
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
            {(mesaSector ? [NAV[0], ...NAV.filter((g) => g.group === 'Mesa'), ...NAV.slice(1).filter((g) => g.group !== 'Mesa')] : NAV).map((g) => {
              // Áreas escondidas somem do menu, mas a aberta continua visível.
              const items = g.items.filter((item) => !item.inside && (!hidden.includes(item.view) || area === item.view))
              if (!items.length) return null
              return (
                <div key={g.group || g.items[0].view} className="rail-group">
                  {g.group && <span className="rail-group-label rail-label">{g.group}</span>}
                  {items.map((item) => (
                    <RailButton key={item.view} item={item} active={area === item.view} onClick={() => go(item.view)} />
                  ))}
                </div>
              )
            })}
            <div className="rail-group rail-group-end">
              {TOOLS.filter((t) => t.view !== 'oficina' && (!hidden.includes(t.view) || nav.view === t.view)).map((t) => (
                <RailButton key={t.view} item={t} active={nav.view === t.view} badge={t.view === 'inbox' ? openInbox || undefined : undefined} onClick={() => go(t.view)} />
              ))}
              {!hidden.includes('oficina') && <OficinaCard compact={collapsed} onClick={() => go('oficina')} />}
              <RailButton item={CONFIG_ITEM} active={nav.view === 'config'} onClick={() => go('config')} />
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
          {/* A entrada do setor: a porta da mesa numa campanha, a capa do livro na escrita (abrindo direto na mesa, quem recebe é a mesa). */}
          {kind === 'campanha' ? (
            <MesaGate name={universe.name || 'Sem nome'} />
          ) : (
            openedIn !== 'rpg' && <WritingGate id={universe.id} name={universe.name || 'Sem nome'} cover={universe.settings.cover} />
          )}
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
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  downloadBackup()
                  setPref('autoBackup', true)
                  toast('Pronto: toda semana o backup baixa sozinho. Dá para desligar em Ajustes → Seus dados.')
                }}
              >
                Baixar toda semana sozinho
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

        {liveSession && nav.view !== 'rpg' && (
          <button
            type="button"
            className="live-return"
            onClick={() => {
              // De volta ao modo sessão, na mesa da sessão ao vivo.
              setOutsideSession(null)
              if (liveSession.groupId) remember(`rpg-grupo:${universe.id}`, liveSession.groupId)
              go('rpg')
            }}
          >
            <span className="live-return-dot" aria-hidden="true" /> Sessão {liveSession.number} ao vivo · <strong>Voltar</strong>
          </button>
        )}
        {peekId && <PeekDrawer entityId={peekId} onClose={() => setPeekId(null)} />}
        {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
        {tourOpen && (
          <Tour
            onGo={tourGo}
            hidden={hidden}
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
      {oficinaOpen && (
        <OficinaPage
          genre={kind === 'campanha' ? 'mestrar' : guessGuide(universe.settings.fieldTemplates)}
          onClose={() => setOficinaOpen(false)}
          onKeep={readOnly ? undefined : (text) => update((u) => insert(u, 'inbox', draftInbox(text))[0])}
          onKeepScene={
            readOnly
              ? undefined
              : (t) => {
                  update((u) => sceneFromTreino(u, t))
                  toast('O texto virou uma cena (em Escrever, fora dos capítulos).')
                }
          }
          onRoteiro={
            readOnly || kind !== 'campanha'
              ? undefined
              : (kindOf, text) => {
                  let label: string | null = null
                  update((u) => {
                    const sent = sendToRoteiro(u, kindOf, text)
                    label = sent?.[1] ?? null
                    return sent ? sent[0] : u
                  })
                  return label
                }
          }
          onPractice={
            readOnly
              ? undefined
              : (title, prompt) => {
                  // O exercício vira uma cena solta, com o enunciado na sinopse.
                  let created: Scene | undefined
                  update((u) => {
                    const [next, sc] = addScene(u, null, `Exercício: ${title}`)
                    created = sc
                    return updateScene(next, sc.id, { synopsis: prompt })
                  })
                  if (created) go('escrever', created.id)
                }
          }
        />
      )}
      {readerOpen &&
        createPortal(
          <ReaderOverlay
            universe={universe}
            preview={source.kind === 'proprio' || source.kind === 'editar'}
            onComment={commentSender(source, universe.id, account.server)}
            commenterName={account.user?.email ? shortName(account.user.email) : undefined}
            onClose={() => setReaderOpen(false)}
          />,
          document.body,
        )}
    </WorkspaceContext.Provider>
  )
}

/** A Oficina no menu: um cartão que diz o que é, e não só mais um item. */
function OficinaCard({ compact = false, onClick }: { compact?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`oficina-card${compact ? ' is-compact' : ''}`} data-tour="nav-oficina" title="Oficina: dicas, livros e exercícios de escrita" onClick={onClick}>
      <span className="oficina-card-icon" aria-hidden="true">
        <GraduationCap size={18} />
      </span>
      {!compact && (
        <span className="oficina-card-text">
          <strong>Oficina</strong>
          <span>Dicas, livros e exercícios</span>
        </span>
      )}
      {compact && <span className="sr-only">Oficina</span>}
    </button>
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
  shortcuts: chosen,
  defaults,
  onShortcuts,
  onBackToWriting,
  onGo,
  onSearch,
  onLibrary,
  onShare,
  extras,
}: {
  items: NavItem[]
  current: View
  inboxCount: number
  universeName: string
  /** Atalhos escolhidos para a barra (até 4). */
  shortcuts: View[]
  /** Os atalhos padrão deste tipo de universo. */
  defaults: View[]
  onShortcuts: (v: View[]) => void
  /** Na mesa de um livro: sair do setor da mesa e voltar à escrita. */
  onBackToWriting?: () => void
  onGo: (v: View) => void
  onSearch: () => void
  onLibrary: () => void
  onShare?: () => void
  /** Conta e tema, no fim do "Mais". */
  extras: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // O "voltar" do aparelho fecha a folha "Mais".
  useBackLayer(() => setOpen(false), open)
  const [editing, setEditing] = useState(false)
  const byView = (v: View) => items.find((i) => i.view === v)
  // Os escolhidos (que estão visíveis), completados com os padrões até 4. Um atalho antigo para uma
  // parte (o Atlas, por exemplo) vira a área em que ela mora (o Mundo).
  const picked = [...chosen, ...defaults]
    .map((v) => ALL_ITEMS.find((i) => i.view === v)?.inside ?? v)
    .filter((v, i, all) => all.indexOf(v) === i && byView(v))
    .slice(0, 4)
  // A área aberta sempre aparece entre os atalhos.
  const views = picked.includes(current) || !byView(current) ? picked : [...picked.slice(0, 3), current]
  const shortcuts = views.map(byView).filter((i): i is NavItem => Boolean(i))
  const choose = (v: View) => {
    setOpen(false)
    setEditing(false)
    onGo(v)
  }
  // Editando: tocar fixa ou tira da barra. O novo entra na frente; com 4, sai o último.
  const toggleShortcut = (v: View) => {
    const now = picked.includes(v) ? picked.filter((x) => x !== v) : [v, ...picked].slice(0, 4)
    if (now.length) onShortcuts(now)
  }
  const grid = items.filter((i) => i.view !== 'oficina')
  const oficina = items.find((i) => i.view === 'oficina')

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
      <button
        type="button"
        className="rail-item"
        aria-expanded={open}
        aria-controls="menu-mais"
        aria-label="Mais"
        title="Mais áreas"
        onClick={() => {
          setOpen(!open)
          setEditing(false)
        }}
      >
        <Menu size={18} aria-hidden="true" />
        <span className="rail-more-label">Mais</span>
        {inboxCount > 0 && !shortcuts.some((i) => i.view === 'inbox') && <span className="rail-badge" aria-hidden="true" />}
      </button>
      {open && (
        <>
          <div className="rail-more-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <div id="menu-mais" className="rail-more" role="group" aria-label="Todas as áreas">
            <button type="button" className="rail-more-universe" aria-label={`Voltar ao início (sair de ${universeName || 'Sem nome'})`} onClick={onLibrary}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="rail-more-universe-text">
                <strong>Voltar ao início</strong>
                <span className="muted tiny">Sair de “{universeName || 'Sem nome'}” · Escrita, RPG e Oficina</span>
              </span>
            </button>
            {onBackToWriting && (
              <button
                type="button"
                className="rail-more-universe"
                onClick={() => {
                  setOpen(false)
                  onBackToWriting()
                }}
              >
                <Feather size={16} aria-hidden="true" />
                <span className="rail-more-universe-text">
                  <strong>Voltar à escrita</strong>
                  <span className="muted tiny">Sair da mesa e voltar ao livro</span>
                </span>
              </button>
            )}
            {oficina && !editing && <OficinaCard onClick={() => choose('oficina')} />}
            {editing && <p className="small rail-more-hint">Toque para pôr ou tirar da barra de baixo (até 4; o novo entra no lugar do último).</p>}
            <div className="rail-more-grid">
              {grid.map((item) => {
                const Icon = item.icon
                const pinned = picked.includes(item.view)
                return editing ? (
                  <button key={item.view} type="button" className={`rail-more-item${pinned ? ' is-pinned' : ''}`} aria-pressed={pinned} onClick={() => toggleShortcut(item.view)}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    {pinned && <Pin size={12} className="rail-more-pin" aria-label="na barra" />}
                  </button>
                ) : (
                  <button key={item.view} type="button" className="rail-more-item" aria-current={current === item.view ? 'page' : undefined} onClick={() => choose(item.view)}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.view === 'inbox' && inboxCount > 0 && <span className="rail-badge">{inboxCount}</span>}
                  </button>
                )
              })}
            </div>
            <div className="rail-more-foot">
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                <Pin size={15} aria-hidden="true" /> {editing ? 'Pronto' : 'Escolher atalhos'}
              </button>
              {onShare && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  data-tour="compartilhar"
                  onClick={() => {
                    setOpen(false)
                    onShare()
                  }}
                >
                  <Users size={16} aria-hidden="true" /> Compartilhar
                </button>
              )}
              {extras}
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
function ReaderOverlay({
  universe,
  preview,
  onClose,
  onComment,
  commenterName,
}: {
  universe: Universe
  preview: boolean
  onClose: () => void
  onComment?: SendComment
  commenterName?: string
}) {
  const [copy] = useState(() => readerCopy(universe, false))
  useBackLayer(onClose)
  return (
    <div className="leitor-overlay" role="dialog" aria-modal="true" aria-label="Modo leitor">
      <ReaderView
        universe={copy}
        storageKey={`leitor:${universe.id}:${preview ? 'previa' : 'leitura'}`}
        onClose={onClose}
        onComment={onComment}
        commenterName={commenterName}
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
