import { novaOn, novaWords } from './novaWords'
import { ArrowLeft, ArrowLeftRight, BookOpen, ChevronDown, ChevronsLeft, Dices, LayoutGrid, ChevronsRight, Eye, GraduationCap, Moon, Pin, Sparkles, Sun, Library as LibraryIcon, Menu, Search, Users, X } from 'lucide-react'
import { ConfirmButton } from '../ui/ConfirmButton'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { relativeDate } from '../logic/relativeDate'
import { canCreateAU, createAU } from '../logic/au'
import { AUBanner } from '../views/AUBanner'
import { keepVersion, versionLabel } from '../persistence/versions'
import { createPortal } from 'react-dom'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { withDailyStart } from '../logic/stats'
import { purgeTrash, track } from '../logic/history'
import { addBook, shelf } from '../export/shelf'
import { authClient, useAccount } from '../account/auth'
import { syncedMap } from '../account/cloud'
import type { Scene, Universe } from '../model/schema'
import { addScene, draftInbox, insert, manuscriptOrder, updateScene, inBook, bookIdsOf, seriesId } from '../model/universe'
import type { Library } from '../persistence/repository'
import { downloadText, fileNameFor } from '../export/download'
import { useFolderSync } from '../persistence/useFolderSync'
import { useUniverse, type SaveStatus } from '../persistence/useUniverse'
import { recall, remember, type usePrefs } from '../state/prefs'
import { BookPicker } from '../ui/BookPicker'
import { WorkspaceContext, type Nav, type ToastOptions, type View, type Workspace } from '../state/workspace'
import { useMediaQuery } from '../ui/useMediaQuery'
import { useCodexSync } from '../share/useCodexSync'
import { setOutsideSession } from '../rpg/sessionFocus'
import { sendToRoteiro } from '../rpg/sessionLife'
import { sceneFromTreino } from '../treino/sceneFromTreino'
import { onIncomingSheet, useTableRolls } from '../share/useTableRolls'
import { openSheetInMesa } from '../views/rpg/openInMesa'
import { isLocalOnly, isSample } from '../model/sample'
import { wordsToday } from '../logic/stats'
import { recordToday } from '../social/dailyWords'
import { progressToShare, shareProgress } from '../social/activity'
import { ShelfSync } from '../social/useShelfSync'
import { AccountButton } from '../account/AccountButton'
import { Tour } from './Tour'
import { usePlay } from './usePlay'
import { backState, backTo, navigateTo, onBackNavigate } from './backStack'
import { useBackLayer } from '../ui/useBackLayer'
import { useImageSync } from '../images/useImageSync'
import { backupOf } from '../persistence/backupFile'
import { onSceneImageError } from '../editor/imageErrors'
import { guessGuide } from '../oficina/guides'
import { isReadOnly, useLiveSync, type LiveSource } from '../share/useLiveSync'
import { MobileSaveStatus } from '../ui/MobileSaveStatus'
import { useSlide } from '../ui/useSlide'
import { useReadOnlyInputs } from './useReadOnlyInputs'
import { shortName } from '../share/sharing'
import { readerCopy } from '../share/readerCopy'
import type { SendComment } from '../reader/ReaderComment'
import { commentSender } from '../share/feedback'
import { Brand } from './Brand'
import { WritingGate } from './WritingGate'
import { useMesaSector } from '../rpg/useMesaSector'
import { useNovaFlag, useWorldClimate } from '../ui/useWorldClimate'
import { BookBand } from '../ui/BookShelf'
import { MenuItem } from '../ui/MenuItem'
import { TOOL_HINTS } from './toolsList'
import { NovidadesDialog } from '../novidades/NovidadesDialog'
import { takeUnseen } from '../novidades/novidades'
import { climaOf } from '../model/climas'
import { linkPlayerSheets } from '../rpg/oneCharacter'
import { mesaTheme } from '../rpg/themes'
import { syncWorldBonuses } from '../rpg/worldBonuses'
import { syncMonstersFromWorld } from '../rpg/bestiary'
import { newlyReady, waitingViews } from '../logic/firstSteps'
import { firstView, hiddenViewsFor, universeKind, CAMPAIGN_SHORTCUTS, type UniverseKind } from '../model/kind'
import { ALL_ITEMS, CONFIG_ITEM, DEFAULT_SHORTCUTS, NAV, TOOLS, type NavItem } from './nav'
import { CaptureDialog } from './CaptureDialog'
import { PeekDrawer } from './PeekDrawer'
import { SearchPalette } from './SearchPalette'
import { ReplaceHost } from '../views/write/ReplaceHost'
import { migrateParents } from '../model/lists'
import { modKey } from '../ui/keys'

const OficinaPage = lazy(() => import('../oficina/OficinaPage').then((m) => ({ default: m.OficinaPage })))
const ShareDialog = lazy(() => import('../share/ShareDialog').then((m) => ({ default: m.ShareDialog })))
const AccountDialog = lazy(() => import('../account/AccountDialog').then((m) => ({ default: m.AccountDialog })))
const ReaderView = lazy(() => import('../reader/ReaderView').then((m) => ({ default: m.ReaderView })))
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
const WikiView = lazy(() => import('../views/WikiView'))
const GuideView = lazy(() => import('../views/GuideView'))
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
  const { universe, status, saveError, update: write, flush, repo, parked, resume, reloads } = useUniverse(library, initial, recovered)
  // Parado: o mesmo universo foi aberto em outra aba (só leitura aqui até "Continuar aqui").
  const readOnly = isReadOnly(source) || parked
  // Quem só vê pode criar um AU se o autor autorizou (Compartilhar › "Pode ver e criar um AU").
  const [auAllowed, setAuAllowed] = useState(false)
  // "Fica dentro de" agora é só de lugar: quem não é lugar passa para uma lista da ficha (uma vez, ao abrir).
  useEffect(() => {
    if (!readOnly) write((u) => migrateParents(u))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState<'wiki' | undefined>(undefined)
  const [readerOpen, setReaderOpen] = useState(() => {
    const asked = recall('abrir-leitor')
    if (asked) remember('abrir-leitor', null)
    return Boolean(asked)
  })
  // A Oficina é uma página à parte, por cima da área de trabalho.
  const [oficinaOpen, setOficinaOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState<string | null>(null)
  const [bookFocus, setBookFocus] = useState<'grafica' | undefined>()
  const closeBook = useCallback(() => setBookOpen(null), [])
  const [sampleNoteClosed, setSampleNoteClosed] = useState(() => recall('exemplo-aviso') === 'fechado')
  // O livro escolhido no alto. Um livro que não existe mais (apagado, ou de outra versão) vale como "todos".
  const [bookPick, setBookPick] = useState<string | null>(() => recall(`livro:${initial.id}`))
  // Um livro ou uma série (ids com vírgula): valem só os livros que ainda existem; uma série que ficou com um só vira esse livro.
  const bookId = bookPick && universe.stories.length > 1 ? seriesId(universe, bookIdsOf(bookPick) ?? []) : null
  const setBookId = useCallback(
    (id: string | null) => {
      setBookPick(id)
      remember(`livro:${universe.id}`, id)
    },
    [universe.id],
  )
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [remoteRev, setRemoteRev] = useState<Record<string, number>>({})
  // Releu o que outra aba salvou: cada cena aberta recomeça com o texto de lá.
  useEffect(() => {
    if (!reloads) return
    setRemoteRev((r) => Object.fromEntries(universe.scenes.map((sc) => [sc.id, (r[sc.id] ?? 0) + 1])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])
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
  const [toolsOpen, setToolsOpen] = useState(() => recall('rail-ferramentas') !== 'fechado')
  // O tour não abre sozinho: a primeira vez começa pelos Primeiros passos do Início. Ele fica no
  // (?) de cada tela, no "Refazer o tour" dos Ajustes e no fim dos Primeiros passos.
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

  // O mais novo do universo e do livro escolhido, para o `go` saber sem mudar a cada letra digitada.
  const latest = useRef({ universe, bookId })
  useEffect(() => {
    latest.current = { universe, bookId }
  })
  const go = useCallback(
    (view: View, id: string | null = null, options: { replace?: boolean } = {}) => {
      if (view === 'oficina') return setOficinaOpen(true)
      // Ir a uma cena de outro livro (o bilhete, a busca, "onde parei"): o livro escolhido passa a ser o dela
      // (ou "todos", se a cena é solta), para a cena aparecer na lista e o resto da tela seguir com ela.
      if (view === 'escrever' && id) {
        const { universe: u, bookId: chosen } = latest.current
        const scene = chosen ? u.scenes.find((s) => s.id === id) : undefined
        if (scene && !inBook(chosen, scene.storyId)) setBookId(scene.storyId)
      }
      navigateTo({ u: initial.id, view, id }, options.replace)
      navRef.current = { view, id }
      setNav({ view, id })
      remember(`vista:${initial.id}`, view)
    },
    [initial.id, setBookId],
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
  const myEmail = account.user?.email
  const auKey = (universe.settings.au?.allowed ?? []).join(',')
  useEffect(() => {
    if (source.kind !== 'ver') return
    let off = false
    void canCreateAU(universe, myEmail).then((ok) => !off && setAuAllowed(ok))
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a lista de autorizados importa
  }, [source.kind, auKey, myEmail])
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
      toast(
        parked
          ? 'Este universo está aberto em outra aba. Toque em “Continuar aqui” para escrever nesta.'
          : source.kind === 'link'
            ? 'Você está lendo pelo link: aqui nada pode ser mudado.'
            : 'Este universo foi compartilhado só para ver. Peça a quem é dono para poder editar.',
      )
    }
  }, [readOnly, tracked, toast, source.kind, parked])
  useReadOnlyInputs(readOnly)
  // Rolagens feitas pelos jogadores no Codex chegam aqui, vão para o registro e para a bandeja da mesa.
  useTableRolls(universe, prefs, tracked, !readOnly)
  // Um jogador criou o próprio personagem pelo convite: o mestre fica sabendo, com um atalho para a ficha.
  const universeId = universe.id
  useEffect(
    () =>
      onIncomingSheet((s) =>
        toast(`${s.player || 'Um jogador'} criou ${s.name} pelo convite.`, {
          action: {
            label: 'Abrir',
            run: () => {
              openSheetInMesa(universeId, s.groupId, s.sheetId)
              go('rpg')
            },
          },
        }),
      ),
    [toast, go, universeId],
  )
  // Bônus do mundo na ficha de jogo (espécie, cultura): sempre em dia com as fichas e ligações.
  useEffect(() => {
    if (readOnly || universe.sheets.length === 0) return
    if (syncWorldBonuses(universe) !== universe) tracked((u) => syncWorldBonuses(u))
  }, [universe, readOnly, tracked])
  // E os inimigos do bestiário que vieram de uma ficha do Mundo acompanham o "No jogo" dela.
  useEffect(() => {
    if (readOnly || !universe.monsters.some((m) => m.entityId)) return
    if (syncMonstersFromWorld(universe) !== universe) tracked((u) => syncMonstersFromWorld(u))
  }, [universe, readOnly, tracked])
  // Um personagem só: uma vez por universo, os personagens de jogador de antes ganham a ficha no Mundo.
  const playersLinked = universe.settings.playersLinked
  const hasSheets = universe.sheets.length > 0
  useEffect(() => {
    if (readOnly || playersLinked || !hasSheets) return
    tracked((u) => {
      const next = linkPlayerSheets(u)
      return { ...next, settings: { ...next.settings, playersLinked: true } }
    })
  }, [readOnly, playersLinked, hasSheets, tracked])

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
    entityId: nav.view === 'fichas' ? (nav.id ?? null) : null,
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
    // Tudo dentro do arquivo (imagens, versões guardadas, o livro escolhido): o backup sozinho basta para ter tudo de volta.
    void backupOf(repo, universe).then((file) => downloadText(fileNameFor(`${universe.name}-backup-${date}`, 'json'), JSON.stringify(file, null, 2), 'application/json'))
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
  /**
   * O clima da Mesa (cores e letras do tema): numa campanha, o universo inteiro; num livro, só
   * dentro da Mesa. O menu não muda com o caminho: a ordem é a do tipo do universo.
   */
  const mesaClimate = kind === 'campanha' || nav.view === 'rpg'
  // Numa campanha, o universo inteiro fica no clima da mesa (o tema do grupo aberto).
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const campaignGroup = universe.groups.find((g) => g.id === recall(`rpg-grupo:${universe.id}`)) ?? universe.groups[0]
  const campaignSystem = campaignGroup?.systemId ? universe.systems.find((x) => x.id === campaignGroup.systemId) : undefined
  useMesaSector(mesaTheme(campaignGroup?.theme, campaignSystem?.name), prefs.theme === 'escuro' || (prefs.theme === 'sistema' && systemDark), mesaClimate)
  // Novidades: depois de uma atualização, um aviso leva a "O que mudou" (que também fica no Menu).
  const [newsOpen, setNewsOpen] = useState(false)
  const [newsUnseen, setNewsUnseen] = useState(false)
  useEffect(() => {
    if (!takeUnseen()) return
    setNewsUnseen(true)
    toast('O Papirus mudou. Veja o que há de novo.', { action: { label: 'Ver', run: () => setNewsOpen(true) } })
    // Só na abertura do universo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Nova cara: o clima do mundo vale no app inteiro.
  useWorldClimate(prefs.novaCara ? climaOf(universe) : null, universe.settings.climaModo ?? 'escuro')
  useNovaFlag(!!prefs.novaCara)
  // Primeira vez mais curta: partes que esperam o uso (ex.: Ligações até haver duas fichas).
  const waiting = useMemo(() => waitingViews(universe, prefs.firstSteps), [universe, prefs.firstSteps])
  const hidden = useMemo(() => [...new Set([...hiddenViewsFor(universe, prefs.menus, prefs.hiddenViews), ...waiting])], [universe, prefs.menus, prefs.hiddenViews, waiting])
  // O que ficou pronto aparece e não some mais (mesmo que a ficha seja apagada depois).
  useEffect(() => {
    const fresh = newlyReady(universe, prefs.firstSteps)
    if (fresh.length && prefs.firstSteps) setPref('firstSteps', { ...prefs.firstSteps, revealed: [...prefs.firstSteps.revealed, ...fresh] })
  }, [universe, prefs.firstSteps, setPref])
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
      openAccount: () => setAccountOpen(true),
      source,
      readOnly,
      others,
      remoteRev,
      setEditingScene,
      openShare: (link?: 'wiki') => {
        setShareLink(link)
        setShareOpen(true)
      },
      openReader: () => setReaderOpen(true),
      openBookDesigner: (bookId?: string, focus?: 'grafica') => {
        setBookFocus(focus)
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
      waitingViews: waiting,
      showAllParts: () => setPref('firstSteps', { active: false, revealed: prefs.firstSteps?.revealed ?? [] }),
      bookId,
      setBookId,
    }),
    [universe, update, status, flush, repo, library, prefs, setPref, nav, go, goBack, toast, undoable, onClose, folder, downloadBackup, source, readOnly, others, remoteRev, kind, hidden, waiting, bookId, setBookId],
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
  // Num livro sem Mesa: o caminho para jogar no mesmo mundo, com as fichas do livro.
  const canPlayHere = kind === 'escrita' && universe.groups.length === 0 && !readOnly && nav.view !== 'rpg'
  // Nova cara: a Trama vira a História (com a Linha do tempo), e a barra de baixo tem os lugares grandes fixos.
  const nova = !!prefs.novaCara
  const visibleItems = ALL_ITEMS.filter((item) => !item.inside && (item.view === 'config' || !hidden.includes(item.view) || nav.view === item.view)).map((item) =>
    nova && item.view === 'tramas' ? { ...item, label: 'História' } : item,
  )
  // A área marcada no menu: o Mapa, por exemplo, fica dentro de Escrever.
  const area = nova && nav.view === 'timeline' ? 'tramas' : (ALL_ITEMS.find((item) => item.view === nav.view)?.inside ?? nav.view)

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
            onGo={(v) => go(nova && v === 'fichas' && universe.maps.length > 0 && nav.view !== 'fichas' && nav.view !== 'atlas' ? 'atlas' : v)}
            onTools={() => go('config', 'ferramentas')}
            shortcuts={nova ? NOVA_PLACES(visibleItems.some((i) => i.view === 'rpg')) : kind === 'campanha' ? prefs.campaignShortcuts : prefs.phoneShortcuts}
            fixed={nova}
            defaults={kind === 'campanha' ? CAMPAIGN_SHORTCUTS : DEFAULT_SHORTCUTS}
            onShortcuts={(v) => setPref(kind === 'campanha' ? 'campaignShortcuts' : 'phoneShortcuts', v)}
            onPlay={canPlayHere ? () => go('rpg') : undefined}
            onSearch={() => setSearchOpen(true)}
            onLibrary={() => void ws.closeUniverse()}
            onShare={source.kind === 'proprio' ? () => setShareOpen(true) : undefined}
            extras={
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setNewsOpen(true)
                    setNewsUnseen(false)
                  }}
                >
                  <Sparkles size={15} aria-hidden="true" /> Novidades{newsUnseen && <span className="novidades-dot" aria-label="(há novidades)" />}
                </button>
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
            {navFor(kind).map((g) => {
              // Áreas escondidas somem do menu, mas a aberta continua visível.
              const items = g.items.filter((item) => !item.inside && (!hidden.includes(item.view) || area === item.view))
              if (!items.length) return null
              return (
                <div key={g.group || g.items[0].view} className="rail-group">
                  {g.group && <span className="rail-group-label rail-label">{g.group}</span>}
                  {items.map((item) => (
                    // Na Nova cara, a Trama se chama História em todo lugar (no celular, nos passeios e aqui também).
                    <RailButton key={item.view} item={nova && item.view === 'tramas' ? { ...item, label: 'História' } : item} active={area === item.view} onClick={() => go(item.view)} />
                  ))}
                </div>
              )
            })}
            {canPlayHere && (
              <div className="rail-group">
                <button type="button" className="rail-item rail-play" title="Usar este mundo numa Mesa de RPG, com as fichas do livro" onClick={() => go('rpg')}>
                  <Dices size={18} aria-hidden="true" />
                  <span className="rail-label">Jogar neste mundo</span>
                </button>
              </div>
            )}
            <div className="rail-group rail-group-end">
              {/* Ferramentas (Ideias, Perguntar ao mundo, Oficina, Guia) num grupo com nome, que se recolhe e o app lembra. */}
              {(() => {
                const tools = TOOLS.filter((t) => !hidden.includes(t.view) || nav.view === t.view)
                const inside = tools.some((t) => nav.view === t.view)
                // Aberto se foi o jeito escolhido, se a área aberta é uma delas, se o tour está passando ou se o menu está recolhido (só ícones).
                const open = toolsOpen || inside || tourOpen || collapsed
                return (
                  <>
                    {tools.length > 0 && !collapsed && (
                      <button
                        type="button"
                        className="rail-group-label rail-tools-toggle"
                        aria-expanded={open}
                        aria-controls="rail-ferramentas"
                        onClick={() => {
                          setToolsOpen(!open)
                          remember('rail-ferramentas', open ? 'fechado' : 'aberto')
                        }}
                      >
                        <span>Ferramentas</span>
                        {!open && openInbox > 0 && <span className="rail-badge" aria-label={`${openInbox} ideias esperando`}>{openInbox}</span>}
                        <ChevronDown size={14} aria-hidden="true" className="rail-tools-chevron" />
                      </button>
                    )}
                    {open && (
                      <div id="rail-ferramentas" className="rail-tools">
                        {tools.map((t) => (
                          <RailButton key={t.view} item={t} active={nav.view === t.view} badge={t.view === 'inbox' ? openInbox || undefined : undefined} onClick={() => go(t.view)} />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
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
            <span className="save-status" data-tour="salvo" role="status" data-status={status} title={status === 'erro' && saveError === 'espaco' ? 'Sem espaço neste aparelho — baixe um backup e limpe imagens sem uso (Ajustes › Dados)' : STATUS_LABEL[status]}>
              <span className="save-dot" aria-hidden="true" />
              <span className="rail-label">{status === 'erro' && saveError === 'espaco' ? 'Sem espaço — não salvou' : STATUS_LABEL[status]}</span>
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
          {phone && <MobileSaveStatus status={status} saveError={saveError} cloud={!!userId && !isLocalOnly(universe)} onFreeSpace={() => go('config')} />}
          {parked && (
            <div className="tab-parked" role="alert">
              <p>
                <strong>Este universo está aberto em outra aba.</strong> O que você escreveu aqui foi salvo. Para uma aba não apagar a outra, esta fica só para ler.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={resume}>
                Continuar aqui
              </button>
            </div>
          )}
          {/* A capa do livro ao abrir um livro (não ao abrir direto na Mesa). A Mesa não tem porta: a abertura é a da sessão. */}
          {kind !== 'campanha' && openedIn !== 'rpg' && <WritingGate id={universe.id} name={universe.name || 'Sem nome'} cover={universe.settings.cover} />}
          {source.kind !== 'proprio' && (
            <SharedBanner
              source={source}
              onLeave={() => void ws.closeUniverse()}
              onRead={() => setReaderOpen(true)}
              onCreateAU={auAllowed && source.kind === 'ver' ? () => onOpenOther(createAU(universe, { id: source.ownerId, email: source.ownerEmail })) : undefined}
            />
          )}
          {source.kind === 'proprio' && universe.derivedFrom && <AUBanner />}
          {/* Uma versão guardada aberta: fica claro que não é o universo, e dá para ficar com ela daqui. */}
          {universe.cloudCopyOf && source.kind === 'proprio' && (
            <div className="sample-banner version-banner" role="status">
              <span className="sample-banner-text">
                <strong>Versão guardada</strong>
                <span className="sample-banner-more">
                  {' '}
                  · {versionLabel(universe.versionKind)} de {relativeDate(universe.updatedAt)}; fica só neste aparelho
                </span>
              </span>
              <ConfirmButton
                className="btn btn-sm btn-primary"
                question="Trocar o universo por esta versão? O que está no universo agora fica guardado como versão."
                confirmLabel="Ficar com esta"
                onConfirm={async () => {
                  const mainId = universe.cloudCopyOf!
                  // Grava o que falta desta versão antes da troca; depois, abre o universo já com ela.
                  await flush()
                  try {
                    await keepVersion(library, mainId, universe.id)
                  } catch (err) {
                    toast(err instanceof Error ? err.message : String(err))
                    return
                  }
                  const main = await library.repository(mainId).load()
                  if (main) onOpenOther(main)
                }}
              >
                Ficar com esta versão
              </ConfirmButton>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void ws.closeUniverse()}>
                Sair
              </button>
            </div>
          )}
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
          <Suspense
            fallback={
              <div className="view-loading" role="status">
                <span className="sr-only">Carregando…</span>
                <span className="skeleton skeleton-title" aria-hidden="true" />
                <span className="skeleton" aria-hidden="true" />
                <span className="skeleton skeleton-short" aria-hidden="true" />
              </div>
            }
          >
            {/* Sem faixa fixa: o livro se escolhe no Início e na lista de cenas; aqui, só um selo quando há um escolhido. */}
            {prefs.novaCara ? nav.view !== 'config' && <BookBand /> : BOOK_VIEWS.includes(nav.view) && <BookPicker className="book-chip" onlyWhenChosen />}
            {/* Cada área tem o seu próprio aviso de erro: se uma tela quebrar, o menu e o resto do app continuam. */}
            <ErrorBoundary resetKey={nav.view} label="Esta parte deu erro" onHome={nav.view === 'inicio' ? undefined : () => go('inicio')} copyDetails>
              <ViewSwitch view={nav.view} navId={nav.id ?? null} onOpenOther={onOpenOther} />
            </ErrorBoundary>
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
            campaign={kind === 'campanha'}
            onClose={() => {
              setTourOpen(false)
              setPref('tourDone', true)
            }}
          />
        )}
        <Suspense fallback={null}>
          {accountOpen && <AccountDialog library={library} prefs={prefs} setPref={setPref} onClose={() => setAccountOpen(false)} />}
          {newsOpen && <NovidadesDialog onClose={() => { setNewsOpen(false); setNewsUnseen(false) }} />}
          {shareOpen && <ShareDialog linkFocus={shareLink} onClose={() => setShareOpen(false)} onAccount={() => setAccountOpen(true)} />}
        </Suspense>
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
      {bookOpen !== null &&
        createPortal(
          <Suspense fallback={<div className="book-designer view-loading">Abrindo a diagramação…</div>}>
            <BookDesigner bookId={bookOpen} focus={bookFocus} onClose={closeBook} />
          </Suspense>,
          document.body,
        )}
      {oficinaOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      {!readOnly && <ReplaceHost />}
      {readerOpen &&
        createPortal(
          <ReaderOverlay
            universe={universe}
            bookId={bookId}
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

/** As áreas que seguem o livro escolhido e mostram o selo dele (o Início e o Escrever têm o seletor próprio). */
const BOOK_VIEWS: View[] = ['organizar', 'livro', 'fichas', 'relacoes', 'timeline', 'atlas', 'tramas', 'conhecimento']

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
    case 'wiki':
      return <WikiView />
    case 'guia':
      return <GuideView />
    case 'archivist':
      return <ArchivistView />
    case 'config':
      // A categoria pedida (ex.: "conta") abre os Ajustes já nela.
      return <SettingsView key={navId ?? ''} onOpenOther={onOpenOther} />
  }
}

/** O "Mais" do celular em grupos, para achar cada área pelo que ela é. */
const MORE_GROUPS: [string, View[]][] = [
  ['Escrever', ['inicio', 'escrever', 'livro']],
  ['Mundo e Trama', ['fichas', 'tramas']],
  ['Mesa de RPG', ['rpg']],
  ['Ferramentas', ['inbox', 'archivist', 'guia', 'config']],
]

function groupsOf(items: NavItem[]): [string, NavItem[]][] {
  const known = new Set(MORE_GROUPS.flatMap(([, v]) => v))
  const groups = MORE_GROUPS.map(([label, views]): [string, NavItem[]] => [novaWords(label, novaOn()), views.flatMap((v) => items.filter((i) => i.view === v))])
  // O que não está em nenhum grupo (uma área nova) vai para Ferramentas.
  const rest = items.filter((i) => !known.has(i.view))
  if (rest.length) groups[groups.length - 1][1].push(...rest)
  return groups.filter(([, list]) => list.length > 0)
}

/**
 * Menu do celular: quatro áreas fixas, com nome, e "Mais" com todas. A barra não troca sozinha:
 * aberta uma área que não está nela, o "Mais" acende com o nome dessa área.
 */
/** Nova cara: os lugares grandes da barra de baixo (a Mesa, se o mundo tem; senão, Publicar). */
/** Na barra de baixo cabe uma palavra: os nomes compridos ficam curtos (o nome inteiro segue no aria-label e no Mais). */
const SHORT_LABEL: Partial<Record<View, string>> = { config: 'Ajustes' }

const NOVA_PLACES = (mesa: boolean): View[] => ['escrever', 'fichas', 'tramas', mesa ? 'rpg' : 'livro']

function PhoneNav({
  items,
  current,
  inboxCount,
  universeName,
  shortcuts: chosen,
  defaults,
  onShortcuts,
  onPlay,
  onGo,
  onTools,
  onSearch,
  onLibrary,
  onShare,
  extras,
  fixed = false,
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
  /** Num livro sem Mesa: começar uma Mesa neste mesmo mundo. */
  onPlay?: () => void
  onGo: (v: View) => void
  /** Abre Ajustes › Todas as ferramentas. */
  onTools: () => void
  onSearch: () => void
  onLibrary: () => void
  onShare?: () => void
  /** Conta e tema, no fim do "Mais". */
  extras: ReactNode
  /** Nova cara: a barra tem os lugares grandes fixos (sem escolher atalhos) e o "Mais" vira "Menu". */
  fixed?: boolean
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
  const shortcuts = picked.map(byView).filter((i): i is NavItem => Boolean(i))
  // A área aberta fora da barra: o "Mais" mostra o nome dela.
  const elsewhere = picked.includes(current) ? undefined : (byView(current) ?? ALL_ITEMS.find((i) => i.view === current))
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
  const MoreIcon = fixed ? Menu : (elsewhere?.icon ?? Menu)
  // O fundo da área aberta desliza de um botão para o outro.
  const slide = useSlide<HTMLElement>('[aria-current="page"]', `${current}|${elsewhere?.view ?? ''}`)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav ref={slide} className="rail rail-phone" aria-label="Áreas" data-tour="menu">
      {shortcuts.map((item) => (
        <RailButton key={item.view} item={item} active={current === item.view} badge={item.view === 'inbox' && inboxCount ? inboxCount : undefined} onClick={() => choose(item.view)} />
      ))}
      <button
        type="button"
        className={`rail-item rail-more-btn${elsewhere ? ' is-elsewhere' : ''}`}
        aria-expanded={open}
        aria-controls="menu-mais"
        aria-current={elsewhere ? 'page' : undefined}
        aria-label={fixed ? 'Menu' : elsewhere ? `Mais (aberto: ${elsewhere.label})` : 'Mais'}
        title="Mais áreas"
        onClick={() => {
          setOpen(!open)
          setEditing(false)
        }}
      >
        <MoreIcon size={18} aria-hidden="true" />
        <span className="rail-label">{fixed ? 'Menu' : elsewhere ? SHORT_LABEL[elsewhere.view] ?? elsewhere.label : 'Mais'}</span>
        {inboxCount > 0 && !shortcuts.some((i) => i.view === 'inbox') && <span className="rail-badge" aria-hidden="true" />}
      </button>
      {open && (
        <>
          <div className="rail-more-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <div id="menu-mais" className="rail-more" role="group" aria-label="Todas as áreas">
            <button
              type="button"
              className="rail-more-search"
              data-tour="busca"
              onClick={() => {
                setOpen(false)
                onSearch()
              }}
            >
              <Search size={17} aria-hidden="true" />
              <span>Buscar em tudo</span>
            </button>
            <button type="button" className="rail-more-universe" aria-label={`Seus universos (sair de ${universeName || 'Sem nome'})`} onClick={onLibrary}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="rail-more-universe-text">
                <strong>Seus universos</strong>
                <span className="muted tiny">Sair de “{universeName || 'Sem nome'}” e ver os outros</span>
              </span>
            </button>
            {oficina && !editing && <OficinaCard onClick={() => choose('oficina')} />}
            {editing && <p className="small rail-more-hint">Toque para pôr ou tirar da barra de baixo (até 4; o novo entra no lugar do último).</p>}
            {groupsOf(grid).map(([label, list]) => (
              <div key={label} className="rail-more-group" role="group" aria-label={label}>
                <p className="rail-more-group-label">{label}</p>
                <div className={`rail-more-grid${fixed && !editing ? ' is-rows' : ''}`}>
                  {list.map((item) => {
                    const Icon = item.icon
                    const pinned = picked.includes(item.view)
                    return editing ? (
                      <button key={item.view} type="button" className={`rail-more-item${pinned ? ' is-pinned' : ''}`} aria-pressed={pinned} onClick={() => toggleShortcut(item.view)}>
                        <Icon size={20} aria-hidden="true" />
                        <span>{item.label}</span>
                        {pinned && <Pin size={12} className="rail-more-pin" aria-label="na barra" />}
                      </button>
                    ) : fixed ? (
                      // Nova cara: cada área com o nome e uma frase do que faz.
                      <MenuItem
                        key={item.view}
                        icon={item.icon}
                        title={item.view === 'inbox' && inboxCount > 0 ? `${item.label} (${inboxCount})` : item.label}
                        hint={TOOL_HINTS[item.view]}
                        pressed={current === item.view}
                        onClick={() => choose(item.view)}
                      />
                    ) : (
                      <button key={item.view} type="button" className="rail-more-item" style={{ '--area': `var(--area-${item.view}, currentColor)` } as React.CSSProperties} aria-current={current === item.view ? 'page' : undefined} onClick={() => choose(item.view)}>
                        <Icon size={20} aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.view === 'inbox' && inboxCount > 0 && <span className="rail-badge">{inboxCount}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {onPlay && !editing && (
              <button
                type="button"
                className="rail-more-universe rail-more-play"
                onClick={() => {
                  setOpen(false)
                  onPlay()
                }}
              >
                <Dices size={16} aria-hidden="true" />
                <span className="rail-more-universe-text">
                  <strong>Jogar neste mundo</strong>
                  <span className="muted tiny">Uma Mesa de RPG com as fichas do livro</span>
                </span>
              </button>
            )}
            {!editing && (
              <button
                type="button"
                className="rail-more-universe rail-more-tools"
                onClick={() => {
                  setOpen(false)
                  onTools()
                }}
              >
                <LayoutGrid size={16} aria-hidden="true" />
                <span className="rail-more-universe-text">
                  <strong>Todas as ferramentas</strong>
                  <span className="muted tiny">Cada área com uma frase do que ela faz</span>
                </span>
              </button>
            )}
            <div className="rail-more-foot">
              {!fixed && (
                <button type="button" className="btn btn-ghost btn-sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                  <Pin size={15} aria-hidden="true" /> {editing ? 'Pronto' : 'Escolher atalhos'}
                </button>
              )}
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

/** A ordem do menu, fixa para cada tipo de universo: numa campanha, a Mesa vem logo depois do Início. */
function navFor(kind: UniverseKind) {
  if (kind !== 'campanha') return NAV
  const mesa = NAV.filter((g) => g.items.some((i) => i.view === 'rpg'))
  return [NAV[0], ...mesa, ...NAV.slice(1).filter((g) => !mesa.includes(g))]
}

/** Faixa no topo de um universo de outra pessoa: de quem é e o que dá para fazer. */
function SharedBanner({ source, onLeave, onRead, onCreateAU }: { source: LiveSource; onLeave: () => void; onRead: () => void; onCreateAU?: () => void }) {
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
      {onCreateAU && (
        <button type="button" className="btn btn-sm btn-primary" onClick={onCreateAU} title="Um universo seu, a partir deste mundo, sem os segredos">
          <Sparkles size={14} /> Criar um AU
        </button>
      )}
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
  bookId,
  preview,
  onClose,
  onComment,
  commenterName,
}: {
  universe: Universe
  /** O livro escolhido no alto: a leitura abre nele (e guarda onde parou, livro a livro). */
  bookId: string | null
  preview: boolean
  onClose: () => void
  onComment?: SendComment
  commenterName?: string
}) {
  const [copy] = useState(() => readerCopy(universe, false))
  // Os livros de antes continuam no caderno do leitor: quem lê o terceiro já leu os dois primeiros.
  const order = manuscriptOrder(copy)
  const start = bookId ? order.findIndex((s) => inBook(bookId, s.storyId)) : -1
  // O fim do livro (ou da série): o "Ouvir" para ali.
  const end = bookId ? order.findLastIndex((s) => inBook(bookId, s.storyId)) : -1
  useBackLayer(onClose)
  return (
    <div className="leitor-overlay" role="dialog" aria-modal="true" aria-label="Modo leitor">
      <Suspense fallback={null}>
      <ReaderView
        universe={copy}
        storageKey={`leitor:${universe.id}:${preview ? 'previa' : 'leitura'}${start >= 0 ? `:${bookId}` : ''}`}
        startAt={start >= 0 ? start : undefined}
        endAt={end >= 0 ? end : undefined}
        onClose={onClose}
        onComment={onComment}
        commenterName={commenterName}
        closeLabel={preview ? 'Voltar ao universo' : 'Fechar o modo leitor'}
        footer={
          preview ? (
            <p className="leitor-preview-note muted tiny">
              Prévia: é assim que um leitor vê, sem nada secreto. Para esconder um spoiler numa ficha, selecione o trecho e use “Esconder do leitor até…”.
            </p>
          ) : undefined
        }
      />
      </Suspense>
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
