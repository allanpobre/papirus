import type { Editor } from '@tiptap/react'
import {
  Download,
  Feather,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SceneEditor, type SelectionInfo } from '../../editor/SceneEditor'
import { downloadText, fileNameFor } from '../../export/download'
import { sceneToMarkdown } from '../../export/markdown'
import { continuityQuestions, isOpen } from '../../logic/continuity'
import { findCandidates, MentionMatcher } from '../../logic/detection'
import { isDialogue } from '../../logic/doc'
import { fold } from '../../logic/text'
import { wordsToday } from '../../logic/stats'
import { KIND_LABEL, SCENE_STATUS_LABEL } from '../../model/labels'
import { ENTITY_KINDS, SCENE_STATUSES, type Scene, type SceneStatus } from '../../model/schema'
import {
  addScene,
  byId,
  draftEntity,
  draftInbox,
  insert,
  manuscriptOrder,
  moveSceneTo,
  namesOf,
  patch,
  removeScene,
  updateScene,
} from '../../model/universe'
import { wordCount } from '../../persistence/repository'
import { recall, remember } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { Field, Select, YearInput } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { EntityMultiPicker, EntityPicker } from '../../ui/EntityPicker'
import { FactDialog, type FactDraft } from '../../ui/FactDialog'
import { Modal } from '../../ui/Modal'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { LiveMargin } from './LiveMargin'
import { ManuscriptTree } from './ManuscriptTree'
import { ReviewDialog } from './ReviewDialog'

type Dialog =
  | { kind: 'link'; sel: SelectionInfo }
  | { kind: 'entity'; sel: SelectionInfo }
  | { kind: 'fact'; initial: Partial<FactDraft> }
  | { kind: 'review' }
  | null

export default function WriteView() {
  const ws = useWorkspace()
  const { universe, update, prefs, setPref, nav, go, peek, toast, undoable } = ws
  const order = manuscriptOrder(universe)

  const [sceneId, setSceneId] = useState<string | null>(() => {
    const wanted = nav.view === 'escrever' && nav.id ? nav.id : recall(`cena:${universe.id}`)
    return wanted && universe.scenes.some((s) => s.id === wanted) ? wanted : (order[0]?.id ?? null)
  })
  const [paragraph, setParagraph] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [focus, setFocus] = useState(false)
  const phone = useMediaQuery('(max-width: 760px)')
  const narrow = useMediaQuery('(max-width: 1180px)')
  const [treeOpen, setTreeOpen] = useState(() => recall('arvore') !== 'fechada' && !matchMedia('(max-width: 760px)').matches)
  const [narrowMargin, setNarrowMargin] = useState(false)
  const marginVisible = narrow ? narrowMargin : prefs.margin
  const [metaOpen, setMetaOpen] = useState(false)
  const editorRef = useRef<Editor | null>(null)

  // Navegação vinda de fora (busca, links): abre a cena pedida.
  useEffect(() => {
    if (nav.view === 'escrever' && nav.id && universe.scenes.some((s) => s.id === nav.id)) setSceneId(nav.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav])

  const scene = sceneId ? byId(universe, 'scenes', sceneId) : undefined

  useEffect(() => {
    if (sceneId) remember(`cena:${universe.id}`, sceneId)
  }, [sceneId, universe.id])

  // O matcher só muda quando nomes de fichas mudam, não a cada tecla.
  const namesKey = universe.entities.map((e) => `${e.id}:${namesOf(e).join('|')}`).join(';')
  const matcher = useMemo(
    () => (prefs.detection ? new MentionMatcher(universe.entities) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namesKey, prefs.detection],
  )

  const questions = useMemo(
    () => continuityQuestions(universe, prefs.continuity).filter((q) => !scene || q.sceneIds.includes(scene.id) || q.sceneId === null),
    [universe, prefs.continuity, scene],
  )
  const sceneQuestions = questions.filter((q) => scene && q.sceneIds.includes(scene.id))

  const candidates = useMemo(
    () => (prefs.discovery && scene ? findCandidates(scene.text, universe.entities, universe.settings.ignoredNames).length : 0),
    // Recalcula após pausas: o texto da cena só muda no estado quando o editor avisa.
    [prefs.discovery, scene, universe.entities, universe.settings.ignoredNames],
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (id: string) => {
    setSceneId(id)
    go('escrever', id)
    // No celular, o manuscrito é um painel por cima do texto: fecha ao escolher.
    if (phone) setTreeOpen(false)
  }

  const newLooseScene = () => {
    let created: Scene | undefined
    update((u) => {
      const [next, s] = addScene(u, null)
      created = s
      return next
    })
    if (created) select(created.id)
  }

  const onChange = useCallback(
    (doc: Scene['doc'], text: string) => {
      if (sceneId) update((u) => updateScene(u, sceneId, { doc, text }))
    },
    [sceneId, update],
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
      toast('Trecho guardado na Inbox')
    },
    openEntity: (id: string) => peek(id),
  }

  if (!scene) {
    return (
      <div className="view write-empty">
        <div className="write-welcome">
          <Feather size={36} aria-hidden="true" />
          <h1>Uma página em branco.</h1>
          <p>Comece por uma cena solta. Histórias, capítulos e fichas podem vir depois — ou nunca.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={newLooseScene}>
            Começar a escrever
          </button>
        </div>
      </div>
    )
  }

  const words = wordCount(scene.text)
  const today = wordsToday(universe)
  const goal = universe.settings.dailyWordGoal
  const set = (changes: Parameters<typeof updateScene>[2]) => update((u) => updateScene(u, scene.id, changes))

  return (
    <div className={`view write${treeOpen ? '' : ' tree-closed'}${marginVisible ? '' : ' margin-closed'}${focus ? ' is-focus' : ''}`}>
      {treeOpen && !focus && (
        <aside className={`write-tree${phone ? ' write-overlay write-overlay-left' : ''}`} aria-label="Manuscrito">
          <ManuscriptTree selectedId={scene.id} onSelect={select} />
        </aside>
      )}

      <div className="write-main">
        <header className="write-bar">
          <button
            type="button"
            className="btn-icon"
            aria-label={treeOpen ? 'Esconder manuscrito' : 'Mostrar manuscrito'}
            onClick={() => {
              setTreeOpen(!treeOpen)
              if (!phone) remember('arvore', treeOpen ? 'fechada' : 'aberta')
            }}
          >
            {treeOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="write-bar-meta">
            <span className={`status-dot status-${scene.status}`} aria-hidden="true" />
            <span className="muted small">{SCENE_STATUS_LABEL[scene.status]}</span>
            {scene.date && (
              <span className="muted small">
                · ano {scene.date.year}
                {scene.date.day !== null && `, dia ${scene.date.day}`} {universe.settings.calendarSuffix}
              </span>
            )}
          </div>
          <div className="write-bar-actions">
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={metaOpen} onClick={() => setMetaOpen(!metaOpen)}>
              <SlidersHorizontal size={15} /> Detalhes da cena
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Exportar cena (Markdown)"
              aria-label="Exportar cena"
              onClick={() => downloadText(fileNameFor(scene.title, 'md'), sceneToMarkdown(scene))}
            >
              <Download size={17} />
            </button>
            <ConfirmButton
              className="btn-icon"
              title="Apagar cena"
              question="Apagar esta cena?"
              confirmLabel="Apagar cena"
              onConfirm={() => {
                const next = order.find((s) => s.id !== scene.id)
                undoable(`Cena “${scene.title || 'Sem título'}” apagada`, (u) => removeScene(u, scene.id))
                setSceneId(next?.id ?? null)
              }}
            >
              <Trash2 size={17} aria-label="Apagar cena" />
            </ConfirmButton>
            <button
              type="button"
              className="btn-icon"
              aria-label={focus ? 'Sair do modo foco' : 'Modo foco'}
              title={focus ? 'Sair do modo foco (Esc)' : 'Modo foco (Ctrl+Shift+F)'}
              onClick={() => setFocus(!focus)}
            >
              {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              type="button"
              className="btn-icon"
              aria-label={marginVisible ? 'Esconder margem' : 'Mostrar margem'}
              onClick={() => (narrow ? setNarrowMargin(!narrowMargin) : setPref('margin', !prefs.margin))}
            >
              {marginVisible ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          </div>
        </header>

        <div className="page-scroll">
          <article
            className={`page page-${prefs.editorWidth} font-${prefs.editorFont}`}
            style={{ ['--editor-size' as string]: `${prefs.editorSize}px` }}
          >
            <label htmlFor="scene-title" className="sr-only">
              Título da cena
            </label>
            <input
              id="scene-title"
              className="scene-title"
              value={scene.title}
              placeholder="Sem título"
              onChange={(e) => set({ title: e.target.value })}
            />

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
                        options={[{ value: '', label: 'Cena solta' }, ...universe.stories.map((s) => ({ value: s.id, label: s.title || 'Sem título' }))]}
                      />
                    )}
                  </Field>
                  <EntityPicker label="Ponto de vista" kinds={['personagem']} value={scene.povId} onChange={(v) => set({ povId: v })} />
                  <EntityPicker label="Local" kinds={['lugar', 'reino']} value={scene.placeId} onChange={(v) => set({ placeId: v })} />
                  <div className="field">
                    <span className="field-label">Data narrativa</span>
                    <div className="inline-fields">
                      <YearInput
                        label="Ano"
                        value={scene.date?.year ?? null}
                        onChange={(y) => set({ date: y === null ? null : { year: y, day: scene.date?.day ?? null } })}
                      />
                      <YearInput
                        label="Dia"
                        placeholder="Dia"
                        value={scene.date?.day ?? null}
                        onChange={(d) => scene.date && set({ date: { ...scene.date, day: d } })}
                      />
                    </div>
                  </div>
                  <div className="field-wide">
                    <EntityMultiPicker label="Elenco presente" value={scene.presentIds} onChange={(ids) => set({ presentIds: ids })} />
                  </div>
                  <Field label="Sinopse" wide>
                    {(id) => (
                      <textarea id={id} className="input textarea" rows={2} value={scene.synopsis} onChange={(e) => set({ synopsis: e.target.value })} />
                    )}
                  </Field>
                  <Field label="Notas da cena" wide hint="Rascunho, outline, lembretes. Não entram na exportação.">
                    {(id) => (
                      <textarea id={id} className="input textarea" rows={3} value={scene.notes} onChange={(e) => set({ notes: e.target.value })} />
                    )}
                  </Field>
                </div>
              </section>
            )}

            <SceneEditor
              key={scene.id}
              doc={scene.doc}
              onChange={onChange}
              onCursorParagraph={setParagraph}
              matcher={matcher}
              actions={actions}
              showToolbar={prefs.toolbar && !focus}
              onReady={(ed) => (editorRef.current = ed)}
            />
          </article>
        </div>

        <footer className="write-foot">
          <span>{words.toLocaleString('pt-BR')} palavras na cena</span>
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
          {sceneQuestions.filter(isOpen).length > 0 && !marginVisible && (
            <button type="button" className="link-btn" onClick={() => setDialog({ kind: 'review' })}>
              {sceneQuestions.filter(isOpen).length} perguntas
            </button>
          )}
        </footer>
      </div>

      {marginVisible && !focus && (
        <LiveMargin
          overlay={narrow}
          onClose={() => setNarrowMargin(false)}
          scene={scene}
          paragraph={paragraph}
          matcher={matcher}
          questions={sceneQuestions}
          candidates={candidates}
          onReview={() => setDialog({ kind: 'review' })}
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
            toast(`Ficha “${name}” criada em rascunho`, { action: { label: 'Abrir', run: () => go('fichas', id) } })
            setDialog(null)
          }}
        />
      )}
    </div>
  )
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
      <p className="muted small">
        O vínculo é seu: a identidade pode continuar misteriosa para personagens e leitores.
      </p>
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
            Criar em rascunho
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome">
          {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Tipo">
          {(id) => <Select id={id} value={kind} onChange={setKind} options={ENTITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />}
        </Field>
      </div>
      <p className="muted small">Uma ficha mínima. Complete quando quiser — ou nunca.</p>
    </Modal>
  )
}
