import type { Editor } from '@tiptap/react'
import { useBackLayer } from '../../ui/useBackLayer'
import {
  ArrowRight,
  BookOpen,
  Download,
  Feather,
  History,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  Search as SearchIcon,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SceneEditor, type SelectionInfo } from '../../editor/SceneEditor'
import { ageIn, ageLabel } from '../../logic/age'
import { SprintButton } from './Sprint'
import { downloadText, fileNameFor } from '../../export/download'
import { sceneToMarkdown } from '../../export/markdown'
import { continuityQuestions, isOpen } from '../../logic/continuity'
import { findCandidates, MentionMatcher } from '../../logic/detection'
import { dayToMonth, formatDate, monthToDay, type Months } from '../../logic/calendar'
import { isDialogue } from '../../logic/doc'
import { fold } from '../../logic/text'
import { wordsToday } from '../../logic/stats'
import { KIND_LABEL, SCENE_STATUS_LABEL } from '../../model/labels'
import { ENTITY_KINDS, SCENE_STATUSES, type Scene, type SceneStatus } from '../../model/schema'
import {
  addScene,
  addSceneAfter,
  autoVersion,
  byId,
  draftEntity,
  draftInbox,
  insert,
  bookScenes,
  moveSceneTo,
  newId,
  namesOf,
  patch,
  removeScene,
  sceneTitle,
  updateScene,
  DEFAULT_SCENE_TITLE,
} from '../../model/universe'
import { wordCount } from '../../persistence/repository'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { BookPicker } from '../../ui/BookPicker'
import { Field, Select, YearInput } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { useSettled } from '../../ui/useSettled'
import { MoreMenu } from '../../ui/MoreMenu'
import { NameIdeas } from '../NameIdeas'
import { EntityMultiPicker, EntityPicker } from '../../ui/EntityPicker'
import { FactDialog, type FactDraft } from '../../ui/FactDialog'
import { Modal } from '../../ui/Modal'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { LiveMargin } from './LiveMargin'
import { ManuscriptTree } from './ManuscriptTree'
import { ReadingMode } from './ReadingMode'
import { ReviewDialog } from './ReviewDialog'
import { VersionsDialog } from './VersionsDialog'
import { PageHelp } from '../../ui/PageTour'
import { SceneReview } from './SceneReview'
import { NextNote } from '../NextNote'
import { nextNoteOf, todayTarget } from '../../logic/homeToday'
import { TextMenu } from './TextMenu'
import { FindBar } from './FindBar'
import { isLore } from '../../logic/au'
import { SceneFrame, saveMode, savedMode, WritingModes, type WritingMode } from './WritingModes'

type Dialog =
  | { kind: 'link'; sel: SelectionInfo }
  | { kind: 'entity'; sel: SelectionInfo }
  | { kind: 'fact'; initial: Partial<FactDraft> }
  | { kind: 'review' }
  | { kind: 'versions' }
  | { kind: 'reading' }
  | { kind: 'comment'; sel: SelectionInfo }
  | null

export default function WriteView() {
  const ws = useWorkspace()
  const { universe, update, prefs, setPref, nav, go, peek, toast, undoable, bookId, setBookId } = ws
  // Com um livro escolhido no alto, o manuscrito é só o dele.
  const order = bookScenes(universe, bookId)
  /** A última cena aberta neste livro (ou a primeira dele). */
  const lastInBook = (id: string | null) => {
    const saved = recall(`cena:${universe.id}:${id ?? ''}`)
    return order.find((s) => s.id === saved)?.id ?? order[0]?.id ?? null
  }

  const [sceneId, setSceneId] = useState<string | null>(() => {
    // Um link (busca, ficha) abre a cena pedida, e o livro vai junto; senão, a última cena do livro escolhido.
    if (nav.view === 'escrever' && nav.id && universe.scenes.some((s) => s.id === nav.id)) return nav.id
    const wanted = recall(`cena:${universe.id}`)
    return wanted && order.some((s) => s.id === wanted) ? wanted : lastInBook(bookId)
  })
  const [paragraph, setParagraph] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [focus, setFocus] = useState(false)
  const phone = useMediaQuery('(max-width: 760px)')
  const narrow = useMediaQuery('(max-width: 1180px)')
  // Página (porta fechada: só o texto) ou Revisão (porta aberta: a margem e as perguntas).
  const [mode, setModeState] = useState<'pagina' | 'revisao'>(savedMode)
  const drafting = mode === 'pagina'
  const note = nextNoteOf(universe)
  const [treeOpen, setTreeOpen] = useState(() => savedMode() === 'revisao' && recall('arvore') !== 'fechada' && !matchMedia('(max-width: 760px)').matches)
  const [narrowMargin, setNarrowMargin] = useState(
    () => savedMode() === 'revisao' && matchMedia('(max-width: 1180px)').matches && !matchMedia('(max-width: 760px)').matches,
  )
  const marginVisible = !drafting && (narrow ? narrowMargin : prefs.margin)
  // No celular, a margem da Revisão é uma gaveta embaixo: o texto e as abas de cima continuam à vista.
  const sheet = phone && !drafting
  // Na Página, a lista de cenas abre por cima do texto (e fecha ao escolher).
  const treeOverlay = phone || drafting
  // "Onde você parou": no toque o cursor não vai sozinho para o fim (abriria o teclado), então a
  // Página mostra a última frase e um botão para continuar dali. Some ao escrever.
  const touch = useMediaQuery('(pointer: coarse), (max-width: 760px)')
  const [resume, setResume] = useState(() => savedMode() === 'pagina')
  const [metaOpen, setMetaOpen] = useState(false)
  // No celular, o manuscrito abre por cima do texto: o "voltar" do aparelho fecha. O modo foco também sai com "voltar".
  useBackLayer(() => setTreeOpen(false), treeOverlay && treeOpen && !focus)
  useEffect(() => {
    if (!treeOverlay || !treeOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.overlay')) setTreeOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [treeOverlay, treeOpen])
  useBackLayer(() => setFocus(false), focus)
  useBackLayer(() => setNarrowMargin(false), sheet && narrowMargin && !focus)
  // Muda quando o texto da cena é trocado por fora (ex.: voltar a uma versão), para remontar o editor.
  const [editorNonce, setEditorNonce] = useState(0)
  const [focusedComment, setFocusedComment] = useState<string | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  // Procurar na cena (Ctrl+F): o texto inicial e um número para reabrir do zero.
  const [find, setFind] = useState<{ query: string; n: number } | null>(null)
  const openFind = useCallback(() => {
    const ed = editorRef.current
    const sel = ed && !ed.isDestroyed ? ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' ') : ''
    setFind((f) => ({ query: sel && sel.length <= 60 && !sel.includes('\n') ? sel : (f?.query ?? ''), n: (f?.n ?? 0) + 1 }))
  }, [])

  // Navegação vinda de fora (busca, links): abre a cena pedida.
  useEffect(() => {
    if (nav.view === 'escrever' && nav.id && universe.scenes.some((s) => s.id === nav.id)) setSceneId(nav.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav])

  // Se a cena aberta não existe (apagada, desfeita, outro universo), cai para a primeira.
  const scene = (sceneId ? byId(universe, 'scenes', sceneId) : undefined) ?? order[0]
  // Num AU, as cenas do original são lore: dá para ler, não para mudar.
  const lore = isLore(universe, scene?.id)

  // Conta para quem mais está no universo qual cena está aberta aqui.
  const { setEditingScene } = ws
  const editingSceneId = scene?.id ?? null
  useEffect(() => {
    setEditingScene(editingSceneId)
    return () => setEditingScene(null)
  }, [editingSceneId, setEditingScene])
  const editingHere = scene ? ws.others.filter((o) => o.sceneId === scene.id) : []

  // Enquanto a cena está aberta, o editor é quem tem o texto. Se o texto mudar por fora
  // (trocar no livro todo, desfazer), o editor recomeça com o texto novo.
  const known = useRef<{ id: string; rev: number; doc: Scene['doc'] } | null>(null)
  const rev = scene ? (ws.remoteRev[scene.id] ?? 0) : 0
  const sceneDoc = scene?.doc
  useEffect(() => {
    if (!scene || !sceneDoc) return
    const k = known.current
    if (!k || k.id !== scene.id || k.rev !== rev) {
      known.current = { id: scene.id, rev, doc: sceneDoc }
      return
    }
    if (k.doc === sceneDoc) return
    known.current = { ...k, doc: sceneDoc }
    if (JSON.stringify(k.doc) !== JSON.stringify(sceneDoc)) setEditorNonce((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, sceneDoc, rev])

  useEffect(() => {
    if (!scene) return
    remember(`cena:${universe.id}`, scene.id)
    remember(`cena:${universe.id}:${scene.storyId ?? ''}`, scene.id)
  }, [scene, universe.id])

  // Trocou o livro no alto: abre a última cena dele (ou a primeira).
  const lastBook = useRef(bookId)
  useEffect(() => {
    if (lastBook.current === bookId) return
    lastBook.current = bookId
    if (bookId && scene?.storyId !== bookId) setSceneId(lastInBook(bookId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])
  // A cena aberta é de outro livro (veio de um link, ou mudou de livro): o livro do alto vai junto.
  useEffect(() => {
    if (scene && bookId && scene.storyId !== bookId) setBookId(scene.storyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, scene?.storyId])

  // O matcher só muda quando nomes de fichas mudam, não a cada tecla.
  const namesKey = universe.entities.map((e) => `${e.id}:${namesOf(e).join('|')}`).join(';')
  const matcher = useMemo(
    () => (prefs.detection ? new MentionMatcher(universe.entities) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namesKey, prefs.detection],
  )

  // As contas pesadas esperam uma pausa na digitação (no celular, cada tecla ficava lenta).
  const calm = useSettled(universe)
  const openId = scene?.id
  const questions = useMemo(
    () => continuityQuestions(calm, prefs.continuity).filter((q) => !openId || q.sceneIds.includes(openId) || q.sceneId === null),
    [calm, prefs.continuity, openId],
  )
  const sceneQuestions = questions.filter((q) => scene && q.sceneIds.includes(scene.id))

  const calmScene = openId ? calm.scenes.find((s) => s.id === openId) : undefined
  const candidates = useMemo(
    () => (prefs.discovery && calmScene ? findCandidates(calmScene.text, calm.entities, calm.settings.ignoredNames).length : 0),
    [prefs.discovery, calmScene, calm.entities, calm.settings.ignoredNames],
  )

  useEffect(() => {
    if (!focus) return
    document.documentElement.classList.add('focus-mode')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.overlay')) setFocus(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.classList.remove('focus-mode')
      window.removeEventListener('keydown', onKey)
    }
  }, [focus])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFocus((f) => !f)
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f' && !document.querySelector('.overlay')) {
        // Ctrl+F procura na cena (em vez da busca do navegador, que não acha nada dentro do editor direito).
        e.preventDefault()
        openFind()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFind])

  const select = (id: string) => {
    setSceneId(id)
    go('escrever', id)
    // No celular (e na Página), o manuscrito é um painel por cima do texto: fecha ao escolher.
    if (treeOverlay) setTreeOpen(false)
    setResume(false)
  }

  /** "Nova cena depois desta": entra logo depois, na mesma história, com o título pronto para trocar. */
  const newSceneAfter = (afterId: string) => {
    let created: Scene | undefined
    update((u) => {
      const [next, s] = addSceneAfter(u, afterId)
      created = s
      return next
    })
    if (!created) return
    select(created.id)
    // Depois do editor (que leva o cursor ao fim do texto ao abrir a cena), o título fica selecionado para trocar.
    setTimeout(() => (document.getElementById('scene-title') as HTMLTextAreaElement | null)?.select(), 120)
  }

  const newLooseScene = () => {
    let created: Scene | undefined
    update((u) => {
      // Num livro escolhido (ainda vazio), a cena nasce nele.
      const [next, s] = addScene(u, bookId)
      created = s
      return next
    })
    if (created) select(created.id)
  }

  const openSceneId = scene?.id
  const onChange = useCallback(
    (doc: Scene['doc'], text: string) => {
      // Antes da primeira mudança do dia, a cena guarda como estava (Versões → "Guardada sozinha").
      if (!openSceneId) return
      if (known.current?.id === openSceneId) known.current = { ...known.current, doc }
      update((u) => updateScene(autoVersion(u, openSceneId), openSceneId, { doc, text }))
    },
    [openSceneId, update],
  )

  const guessFact = (sel: SelectionInfo): Partial<FactDraft> => {
    const found = matcher?.find(sel.text) ?? []
    const subject = found[0]
    const object = found.find((m) => m.entityId !== subject?.entityId)
    const dialogue = isDialogue(sel.paragraph)
    let predicate = ''
    let value = ''
    if (subject && object) predicate = sel.text.slice(subject.to, object.from).trim().toLowerCase()
    else if (subject) value = sel.text.slice(subject.to).trim().replace(/[.!?…;,]+$/, '')
    else value = sel.text
    const speaker = dialogue
      ? (matcher?.find(sel.paragraph) ?? []).find(
          (m) => m.entityId !== subject?.entityId && scene?.presentIds.includes(m.entityId),
        )?.entityId
      : undefined
    return {
      subjectId: subject?.entityId ?? null,
      objectId: object?.entityId ?? null,
      predicate,
      value: object ? '' : value,
      quote: sel.text,
      sourceSceneId: scene?.id ?? null,
      speakerId: speaker ?? null,
      // Dito numa fala é afirmação de personagem, não verdade estabelecida.
      canon: dialogue ? 'rumor' : 'estabelecido',
      note: dialogue ? 'Dito numa fala.' : '',
    }
  }

  const actions = {
    link: (sel: SelectionInfo) => sel.text && setDialog({ kind: 'link', sel }),
    capture: (sel: SelectionInfo) => sel.text && setDialog({ kind: 'fact', initial: guessFact(sel) }),
    createEntity: (sel: SelectionInfo) => sel.text && setDialog({ kind: 'entity', sel }),
    keep: (sel: SelectionInfo) => {
      if (!sel.text) return
      update((u) => insert(u, 'inbox', draftInbox(sel.text, 'captura', scene?.title ?? ''))[0])
      toast('Trecho guardado em Ideias')
    },
    openEntity: (id: string) => peek(id),
    comment: (sel: SelectionInfo) => sel.text && setDialog({ kind: 'comment', sel }),
    openComment: (id: string) => {
      setFocusedComment(id)
      if (narrow) setNarrowMargin(true)
      else if (!prefs.margin) setPref('margin', true)
    },
  }

  const setMode = (m: WritingMode) => {
    if (m === 'mapa') return go('organizar')
    setModeState(m)
    saveMode(m)
    setResume(false)
    if (m === 'pagina') {
      setTreeOpen(false)
      return
    }
    // A Revisão abre com a margem à vista (e a lista de cenas como estava).
    if (narrow) setNarrowMargin(true)
    else if (!prefs.margin) setPref('margin', true)
    if (!phone) setTreeOpen(recall('arvore') !== 'fechada')
  }

  if (!scene) {
    return (
      <div className="view write-empty">
        <div className="write-welcome">
          <PageHelp tour="escrever-vazio" className="write-welcome-help" />
          <BookPicker className="tree-book" />
          <Feather size={36} aria-hidden="true" />
          <h1>Uma página em branco.</h1>
          <p>Comece por uma cena. Histórias, capítulos e fichas podem vir depois — ou nunca.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={newLooseScene}>
            Começar a escrever
          </button>
        </div>
      </div>
    )
  }

  const words = wordCount(scene.text)
  const today = wordsToday(universe)
  // A mesma meta de hoje do Início: a diária, ou a que sai do prazo do livro.
  const goal = todayTarget(universe).target
  const set = (changes: Parameters<typeof updateScene>[2]) => update((u) => updateScene(u, scene.id, changes))
  const siblings = order.filter((x) => x.storyId === scene.storyId)
  const at = siblings.findIndex((x) => x.id === scene.id)
  const [prev, next] = [siblings[at - 1], siblings[at + 1]]
  const story = scene.storyId ? byId(universe, 'stories', scene.storyId) : undefined
  const storyName = story ? story.title || 'Sem título' : 'Sem capítulo'

  return (
    <div
      className={`view write is-${mode}${treeOpen && !treeOverlay ? '' : ' tree-closed'}${marginVisible && !sheet ? '' : ' margin-closed'}${focus ? ' is-focus' : ''}${sheet && narrowMargin && !focus ? ' sheet-open' : ''}`}
    >
      {treeOpen && !focus && (
        <aside className={`write-tree${treeOverlay ? ' write-overlay write-overlay-left' : ''}`} aria-label="Manuscrito">
          <ManuscriptTree selectedId={scene.id} onSelect={select} bookPicker />
        </aside>
      )}
      {treeOpen && !focus && treeOverlay && !phone && (
        <button type="button" className="write-scrim" aria-label="Fechar a lista de cenas" tabIndex={-1} onClick={() => setTreeOpen(false)} />
      )}

      <div className="write-main">
        <header className="write-bar">
          <button
            type="button"
            className="btn-icon"
            aria-label={treeOpen ? 'Esconder manuscrito' : 'Mostrar manuscrito'}
            onClick={() => {
              setTreeOpen(!treeOpen)
              if (!treeOverlay) remember('arvore', treeOpen ? 'fechada' : 'aberta')
            }}
          >
            {treeOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <WritingModes current={mode} onPick={setMode} />
          <div className="write-bar-meta">
            {/* Onde esta cena está no livro; um toque abre a lista de cenas. */}
            <button type="button" className="write-pos" title="Ver a lista de cenas" aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}>
              <span className="write-pos-story">{storyName}</span>
              <span className="write-pos-at">
                {' '}
                · cena {at + 1} de {siblings.length}
              </span>
            </button>
            <span className={`status-dot status-${scene.status}`} title={SCENE_STATUS_LABEL[scene.status]} aria-hidden="true" />
            <span className="muted small write-bar-status">{SCENE_STATUS_LABEL[scene.status]}</span>
            {scene.date && <span className="muted small write-bar-date">· {formatDate(universe, scene.date)}</span>}
          </div>
          <div className="write-bar-actions">
            <PageHelp tour="escrever" />
            <TextMenu phone={phone} />
            {/* No celular, Detalhes da cena e Modo foco moram no ⋯: assim os três modos cabem com o nome. */}
            {!phone && (
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={metaOpen} onClick={() => setMetaOpen(!metaOpen)}>
                <SlidersHorizontal size={15} /> Detalhes da cena
              </button>
            )}
            <MoreMenu label="Mais ações da cena">
              {(close) => (
                <>
                  {phone && (
                    <button
                      type="button"
                      className="more-menu-item"
                      aria-expanded={metaOpen}
                      onClick={() => {
                        close()
                        setMetaOpen(!metaOpen)
                      }}
                    >
                      <SlidersHorizontal size={16} /> Detalhes da cena
                    </button>
                  )}
                  {phone && (
                    <button
                      type="button"
                      className="more-menu-item"
                      onClick={() => {
                        close()
                        setFocus(!focus)
                      }}
                    >
                      {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {focus ? 'Sair do modo foco' : 'Modo foco'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      openFind()
                    }}
                  >
                    <SearchIcon size={16} /> Procurar e trocar
                  </button>
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      setDialog({ kind: 'versions' })
                    }}
                  >
                    <History size={16} /> Versões da cena
                  </button>
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      setDialog({ kind: 'reading' })
                    }}
                  >
                    <BookOpen size={16} /> Ler
                  </button>
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      close()
                      downloadText(fileNameFor(scene.title, 'md'), sceneToMarkdown(scene))
                    }}
                  >
                    <Download size={16} /> Exportar cena
                  </button>
                  <ConfirmButton
                    className="more-menu-item more-menu-danger"
                    question="Apagar esta cena?"
                    confirmLabel="Apagar cena"
                    onConfirm={() => {
                      close()
                      const next = order.find((s) => s.id !== scene.id)
                      undoable(`Cena “${sceneTitle(scene)}” apagada`, (u) => removeScene(u, scene.id))
                      setSceneId(next?.id ?? null)
                    }}
                  >
                    <Trash2 size={16} /> Apagar cena
                  </ConfirmButton>
                </>
              )}
            </MoreMenu>
            {!phone && (
              <button
                type="button"
                className="btn-icon"
                aria-label={focus ? 'Sair do modo foco' : 'Modo foco'}
                title={focus ? 'Sair do modo foco (Esc)' : 'Modo foco (Ctrl+Shift+F)'}
                onClick={() => setFocus(!focus)}
              >
                {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            )}
            {!drafting && !sheet && (
              <button
                type="button"
                className="btn-icon"
                aria-label={marginVisible ? 'Esconder margem' : 'Mostrar margem'}
                onClick={() => (narrow ? setNarrowMargin(!narrowMargin) : setPref('margin', !prefs.margin))}
              >
                {marginVisible ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>
            )}
          </div>
        </header>

        {find && (
          <FindBar
            key={find.n}
            editor={editor}
            initial={find.query}
            phone={phone}
            onClose={() => {
              setFind(null)
              editorRef.current?.commands.focus()
            }}
          />
        )}

        <div className="page-scroll">
          <article
            data-tour="editor"
            className={`page page-${prefs.editorWidth} font-${prefs.editorFont}${prefs.typewriter ? ' typewriter' : ''}${prefs.focusParagraph ? ' focus-paragraph' : ''}${drafting ? ' is-drafting' : ''}`}
            style={{ ['--editor-size' as string]: `${prefs.editorSize}px` }}
            onInput={resume ? () => setResume(false) : undefined}
            // Tocou no texto para escrever: o cartão sai da frente (o botão "Continuar" dele não conta).
            onFocusCapture={resume ? (e) => (e.target as Element).closest?.('.ProseMirror') && setResume(false) : undefined}
          >
            {/* No celular a barra não tem lugar: a posição fica em cima do título. */}
            {phone && !focus && (
              <button type="button" className="page-pos" onClick={() => setTreeOpen(true)}>
                {storyName} · cena {at + 1} de {siblings.length}
                {universe.stories.length > 1 && <ChevronDown size={14} aria-hidden="true" />}
              </button>
            )}
            <label htmlFor="scene-title" className="sr-only">
              Título da cena
            </label>
            <textarea
              key={scene.id}
              id="scene-title"
              className="scene-title"
              rows={1}
              value={scene.title === DEFAULT_SCENE_TITLE ? '' : scene.title}
              placeholder="Título (opcional)"
              readOnly={ws.readOnly || lore}
              // O título quebra a linha em vez de ser cortado; Enter não cria parágrafo.
              ref={growTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              onChange={(e) => {
                growTitle(e.currentTarget)
                set({ title: e.target.value.replace(/\n/g, ' ') })
              }}
            />

            {drafting && <SceneFrame scene={scene} compact={phone} />}
            {drafting && touch && resume && scene.text.trim() && (
              <div className="resume" role="status">
                <span className="resume-label">Onde você parou</span>
                <span className="resume-text">“{lastSentence(scene.text)}”</span>
                {note?.sceneId === scene.id && (
                  <span className="resume-note">
                    <strong>Seu bilhete:</strong> {note.text}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setResume(false)
                    editorRef.current?.commands.focus('end')
                  }}
                >
                  Continuar
                </button>
              </div>
            )}

            {metaOpen && (
              <section className="scene-meta" aria-label="Detalhes da cena">
                <div className="form-grid">
                  <Field label="Estado">
                    {(id) => (
                      <Select<SceneStatus>
                        id={id}
                        value={scene.status}
                        onChange={(v) => set({ status: v })}
                        options={SCENE_STATUSES.map((s) => ({ value: s, label: SCENE_STATUS_LABEL[s] }))}
                      />
                    )}
                  </Field>
                  <Field label="História">
                    {(id) => (
                      <Select
                        id={id}
                        value={scene.storyId ?? ''}
                        onChange={(v) => update((u) => moveSceneTo(u, scene.id, v || null))}
                        options={[{ value: '', label: 'Sem capítulo' }, ...universe.stories.map((s) => ({ value: s.id, label: s.title || 'Sem título' }))]}
                      />
                    )}
                  </Field>
                  <EntityPicker label="Ponto de vista" kinds={['personagem']} value={scene.povId} onChange={(v) => set({ povId: v })} />
                  <EntityPicker label="Local" kinds={['lugar', 'reino']} value={scene.placeId} onChange={(v) => set({ placeId: v })} />
                  <div className="field">
                    <span className="field-label">Data narrativa</span>
                    <div className="inline-fields date-parts">
                      <DatePart label="Ano">
                        <YearInput
                          label="Ano"
                          value={scene.date?.year ?? null}
                          onChange={(y) => set({ date: y === null ? null : { year: y, day: scene.date?.day ?? null } })}
                        />
                      </DatePart>
                      {universe.settings.calendarMonths.length > 0 && scene.date ? (
                        <MonthDayInput
                          months={universe.settings.calendarMonths}
                          day={scene.date.day}
                          onChange={(d) => scene.date && set({ date: { ...scene.date, day: d } })}
                        />
                      ) : (
                        <DatePart label="Dia">
                          <YearInput
                            label="Dia"
                            placeholder="Dia"
                            value={scene.date?.day ?? null}
                            onChange={(d) => scene.date && set({ date: { ...scene.date, day: d } })}
                          />
                        </DatePart>
                      )}
                    </div>
                  </div>
                  <div className="field-wide">
                    <EntityMultiPicker label="Elenco presente" value={scene.presentIds} onChange={(ids) => set({ presentIds: ids })} />
                    {(() => {
                      const ages = [scene.povId, ...scene.presentIds]
                        .filter((id, i, all): id is string => Boolean(id) && all.indexOf(id) === i)
                        .flatMap((id) => {
                          const e = byId(universe, 'entities', id)
                          const age = e ? ageIn(e, scene.date?.year) : null
                          return e && age !== null ? [`${e.name}, ${ageLabel(age)}`] : []
                        })
                      return ages.length ? <p className="muted tiny scene-ages">Idades nesta cena: {ages.join(' · ')}</p> : null
                    })()}
                  </div>
                  <Field label="Sinopse" wide>
                    {(id) => <textarea id={id} className="input textarea" rows={2} value={scene.synopsis} onChange={(e) => set({ synopsis: e.target.value })} />}
                  </Field>
                  <Field label="Notas da cena" wide hint="Rascunho, outline, lembretes. Não entram na exportação.">
                    {(id) => <textarea id={id} className="input textarea" rows={3} value={scene.notes} onChange={(e) => set({ notes: e.target.value })} />}
                  </Field>
                </div>
              </section>
            )}

            {editingHere.length > 0 && (
              <p className="editing-here" role="status">
                <span className="editing-dot" aria-hidden="true" />
                <span>
                  <strong>{editingHere.map((o) => o.who).join(', ')}</strong> {editingHere.length === 1 ? 'está' : 'estão'} com esta cena aberta agora. O que cada um
                  escreve é juntado em segundos; se mexerem nela ao mesmo tempo, a outra versão vira uma cópia ao lado.
                </span>
              </p>
            )}
            {lore && (
              <p className="notice small au-lore" role="status">
                Esta cena é do original, de {ws.universe.derivedFrom ? ws.universe.derivedFrom.ownerEmail.split('@')[0] : 'outra pessoa'}: é lore, dá para ler, não para mudar. Escreva as suas numa história nova.
              </p>
            )}
            <SceneEditor
              key={`${scene.id}:${editorNonce}:${ws.remoteRev[scene.id] ?? 0}`}
              editable={!ws.readOnly && !lore}
              doc={scene.doc}
              onChange={onChange}
              onCursorParagraph={setParagraph}
              matcher={matcher}
              actions={actions}
              showToolbar={prefs.toolbar && !focus && !ws.readOnly && !lore}
              onReady={(ed) => {
                editorRef.current = ed
                setEditor(ed)
              }}
              typewriter={prefs.typewriter}
              keySound={prefs.keySound}
              newNames={ws.readOnly ? 0 : candidates}
              onNames={() => setDialog({ kind: 'review' })}
            />
            {scene.text.trim() && !focus && <NextNote sceneId={scene.id} place="pagina" />}
            {scene.text.trim() && !focus && (
              <nav className="scene-end" aria-label="Depois desta cena">
                {next && (
                  <button type="button" className="scene-end-next" onClick={() => select(next.id)}>
                    <span className="scene-end-kick">Próxima cena</span>
                    <span className="scene-end-title">{sceneTitle(next)}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                )}
                {!ws.readOnly && (
                  <button type="button" className="btn btn-ghost btn-sm scene-end-new" onClick={() => newSceneAfter(scene.id)}>
                    <Plus size={14} aria-hidden="true" /> Nova cena depois desta
                  </button>
                )}
              </nav>
            )}
          </article>
        </div>

        {sheet && !focus && (
          <section className={`margin-sheet${narrowMargin ? ' is-open' : ''}`} aria-label="Margem da Revisão">
            <button type="button" className="margin-sheet-handle" aria-expanded={narrowMargin} onClick={() => setNarrowMargin(!narrowMargin)}>
              <span className="margin-sheet-grip" aria-hidden="true" />
              <span className="margin-sheet-title">
                <strong>Margem</strong>
                <span className="muted">
                  {' '}
                  ·{' '}
                  {waitingLabel(sceneQuestions.filter(isOpen).length, candidates)}
                </span>
              </span>
              {narrowMargin ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
            </button>
            {narrowMargin && (
              <LiveMargin
                focusedComment={focusedComment}
                onRemoveCommentMark={(id) => editorRef.current?.commands.removeComment(id)}
                sheet
                scene={scene}
                paragraph={paragraph}
                matcher={matcher}
                questions={sceneQuestions}
                candidates={candidates}
                onReview={() => setDialog({ kind: 'review' })}
                top={
                  <SceneReview scene={scene} questions={sceneQuestions} onPrev={prev ? () => select(prev.id) : undefined} onNext={next ? () => select(next.id) : undefined} />
                }
              />
            )}
          </section>
        )}

        <footer className="write-foot">
          {/* No celular, o rodapé cabe numa linha: o complemento de cada rótulo fica só para o leitor de tela. */}
          <span>
            {words.toLocaleString('pt-BR')} palavras<span className="foot-long"> na cena</span>
          </span>
          <span className="write-goal">
            Hoje: {today.toLocaleString('pt-BR')}
            {goal > 0 && (
              <>
                {' '}
                / {goal.toLocaleString('pt-BR')}
                <span className="goal-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
                </span>
              </>
            )}
          </span>
          {!ws.readOnly && <SprintButton />}
          {/* Os nomes que o Papirus percebeu no texto, à vista enquanto se escreve: um toque abre a lista. */}
          {!ws.readOnly && candidates > 0 && (
            <button type="button" className="link-btn write-waiting write-names" onClick={() => setDialog({ kind: 'review' })}>
              <span className="write-waiting-dot" aria-hidden="true" />
              {candidates === 1 ? '1 nome' : `${candidates} nomes`}
              <span className="foot-long">{candidates === 1 ? ' novo' : ' novos'}</span>
            </button>
          )}
          {sceneQuestions.filter(isOpen).length > 0 &&
            (drafting ? (
              <button type="button" className="link-btn write-waiting" onClick={() => setMode('revisao')}>
                <span className="write-waiting-dot" aria-hidden="true" />
                {sceneQuestions.filter(isOpen).length === 1 ? '1 pergunta' : `${sceneQuestions.filter(isOpen).length} perguntas`}
                <span className="foot-long"> esperando a revisão</span>
              </button>
            ) : (
              !marginVisible &&
              !sheet && (
                <button type="button" className="link-btn" onClick={() => setDialog({ kind: 'review' })}>
                  {sceneQuestions.filter(isOpen).length} perguntas
                </button>
              )
            ))}
        </footer>
      </div>

      {marginVisible && !focus && !sheet && (
        <LiveMargin
          focusedComment={focusedComment}
          onRemoveCommentMark={(id) => editorRef.current?.commands.removeComment(id)}
          overlay={narrow}
          onClose={() => setNarrowMargin(false)}
          scene={scene}
          paragraph={paragraph}
          matcher={matcher}
          questions={sceneQuestions}
          candidates={candidates}
          onReview={() => setDialog({ kind: 'review' })}
          top={
            <SceneReview scene={scene} questions={sceneQuestions} onPrev={prev ? () => select(prev.id) : undefined} onNext={next ? () => select(next.id) : undefined} />
          }
        />
      )}

      {dialog?.kind === 'comment' && (
        <CommentDialog
          sel={dialog.sel}
          onClose={() => setDialog(null)}
          onSave={(text) => {
            const id = newId()
            update((u) =>
              updateScene(u, scene.id, {
                comments: [...(byId(u, 'scenes', scene.id)?.comments ?? []), { id, text, quote: dialog.sel.text, resolved: false, at: new Date().toISOString() }],
              }),
            )
            editorRef.current?.chain().focus().setTextSelection({ from: dialog.sel.from, to: dialog.sel.to }).setComment(id).run()
            setFocusedComment(id)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'versions' && <VersionsDialog scene={scene} onClose={() => setDialog(null)} onRestored={() => setEditorNonce((n) => n + 1)} />}
      {dialog?.kind === 'reading' && (
        <ReadingMode
          title={scene.storyId ? byId(universe, 'stories', scene.storyId)?.title || 'Sem título' : 'Sem capítulo'}
          scenes={order.filter((s) => s.storyId === scene.storyId)}
          startSceneId={scene.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'review' && <ReviewDialog scene={scene} questions={questions} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'fact' && <FactDialog initial={dialog.initial} onClose={() => setDialog(null)} title="Capturar fato" />}
      {dialog?.kind === 'link' && (
        <LinkDialog
          sel={dialog.sel}
          onClose={() => setDialog(null)}
          onLink={(id, addAlias) => {
            const ed = editorRef.current
            ed?.chain().focus().setTextSelection({ from: dialog.sel.from, to: dialog.sel.to }).setMention(id).run()
            if (addAlias) {
              const e = byId(universe, 'entities', id)
              if (e) update((u) => patch(u, 'entities', id, { aliases: [...e.aliases, dialog.sel.text] }))
            }
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'entity' && (
        <NewEntityDialog
          name={dialog.sel.text}
          onClose={() => setDialog(null)}
          onCreate={(kind, name) => {
            let id = ''
            update((u) => {
              const [next, e] = insert(u, 'entities', draftEntity(kind, name))
              id = e.id
              return next
            })
            editorRef.current?.chain().focus().setTextSelection({ from: dialog.sel.from, to: dialog.sel.to }).setMention(id).run()
            toast(`Ficha “${name}” criada`, { action: { label: 'Abrir', run: () => go('fichas', id) } })
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

/** A última frase do texto (para "Onde você parou"), cortada se for comprida. */
function lastSentence(text: string): string {
  const parts = text.trim().split(/(?<=[.!?…])\s+/)
  const last = parts[parts.length - 1] ?? ''
  return last.length > 220 ? `…${last.slice(-220)}` : last
}

/** O título cresce em altura para caber inteiro (no celular, títulos longos quebram a linha). */
function growTitle(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function LinkDialog({ sel, onClose, onLink }: { sel: SelectionInfo; onClose: () => void; onLink: (id: string, alias: boolean) => void }) {
  const { universe } = useWorkspace()
  const [id, setId] = useState<string | null>(null)
  const [alias, setAlias] = useState(true)
  const entity = id ? byId(universe, 'entities', id) : undefined
  const isKnownName = entity ? namesOf(entity).some((n) => fold(n) === fold(sel.text)) : true
  return (
    <Modal
      title="Vincular a uma ficha"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!id} onClick={() => id && onLink(id, alias && !isKnownName)}>
            Vincular
          </button>
        </>
      }
    >
      <blockquote className="quote">“{sel.text}”</blockquote>
      <EntityPicker label="Ficha" value={id} onChange={setId} />
      {entity && !isKnownName && (
        <label className="check">
          <input type="checkbox" checked={alias} onChange={(e) => setAlias(e.target.checked)} />
          Guardar “{sel.text}” como outro nome de {entity.name}
        </label>
      )}
      <p className="muted small">O vínculo é seu: a identidade pode continuar misteriosa para personagens e leitores.</p>
    </Modal>
  )
}

function NewEntityDialog({ name: initial, onClose, onCreate }: { name: string; onClose: () => void; onCreate: (kind: string, name: string) => void }) {
  const [name, setName] = useState(initial)
  const [kind, setKind] = useState('personagem')
  return (
    <Modal
      title="Nova ficha"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => onCreate(kind, name.trim())}>
            Criar ficha
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Tipo">{(id) => <Select id={id} value={kind} onChange={setKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />}</Field>
      </div>
      <NameIdeas kind={kind} onPick={setName} />
      <p className="muted small">Uma ficha mínima. Complete quando quiser — ou nunca.</p>
    </Modal>
  )
}

/** Dia no calendário próprio: mês e dia do mês (guardado como dia do ano). */
function MonthDayInput({ months, day, onChange }: { months: Months; day: number | null; onChange: (day: number | null) => void }) {
  const md = day === null ? null : dayToMonth(months, day)
  return (
    <>
      <DatePart label="Dia">
        <YearInput
          label="Dia do mês"
          placeholder="Dia"
          value={md?.dayOfMonth ?? null}
          onChange={(d) => onChange(d === null ? null : monthToDay(months, md?.month ?? 0, Math.max(1, Math.min(d, months[md?.month ?? 0].days))))}
        />
      </DatePart>
      <DatePart label="Mês">
        <Select
          label="Mês"
          value={String(md?.month ?? '')}
          onChange={(m) => onChange(m === '' ? null : monthToDay(months, Number(m), Math.min(md?.dayOfMonth ?? 1, months[Number(m)].days)))}
          options={[{ value: '', label: 'Mês…' }, ...months.map((m, i) => ({ value: String(i), label: m.name }))]}
        />
      </DatePart>
    </>
  )
}

/** Um pedaço da data com o nome à vista (antes era só a dica dentro do campo, que some ao digitar). */
function DatePart({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="date-part">
      <span className="date-part-label">{label}</span>
      {children}
    </label>
  )
}

function CommentDialog({ sel, onClose, onSave }: { sel: SelectionInfo; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <Modal
      title="Comentar trecho"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
            Comentar
          </button>
        </>
      }
    >
      <blockquote className="quote">“{sel.text}”</blockquote>
      <label htmlFor="comment-text" className="sr-only">
        Comentário
      </label>
      <textarea
        id="comment-text"
        className="input textarea"
        rows={3}
        autoFocus
        placeholder="Ex.: reescrever com mais tensão; conferir a data"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) onSave(text.trim())
        }}
      />
      <p className="muted small">Só você vê. Comentários não saem na exportação.</p>
    </Modal>
  )
}

/** O que espera na margem: as perguntas e os nomes novos ("nada esperando" só quando não há nenhum). */
function waitingLabel(questions: number, names: number) {
  const parts = [questions ? (questions === 1 ? '1 pergunta' : `${questions} perguntas`) : '', names ? (names === 1 ? '1 nome novo' : `${names} nomes novos`) : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'nada esperando'
}
