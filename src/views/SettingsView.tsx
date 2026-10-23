import { Camera, Compass, Search, Download, FileJson, FileUp, FolderOpen, GitBranch, HardDrive, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { downloadText, fileNameFor } from '../export/download'
import { universeToMarkdown } from '../export/markdown'
import type { QuestionType } from '../logic/continuity'
import { migrate } from '../model/migrations'
import type { Universe } from '../model/schema'
import { forkUniverse, newId } from '../model/universe'
import type { SnapshotInfo } from '../persistence/repository'
import { isStoragePersisted, requestPersistentStorage, storageEstimate } from '../persistence/storage'
import { recall, remember, type Prefs } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { Field, Kbd, Select, YearInput } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { NAV } from '../shell/nav'
import { daysInYear } from '../logic/calendar'
import type { View } from '../state/workspace'
import { modKey } from '../ui/keys'
import { BookCard } from './BookCard'
import { ServerCard } from './ServerCard'
import { AccentPicker, AccountCard } from './SettingsParts'
import { matches, SETTINGS_CATEGORIES, type SettingsCategory } from './settingsCategories'

const QUESTION_LABEL: Record<QuestionType, string> = {
  'presenca-dupla': 'Personagem em dois lugares no mesmo dia',
  'apos-fim': 'Aparece depois da morte ou do fim registrado',
  'antes-inicio': 'Aparece antes do nascimento ou do início',
  'fatos-divergentes': 'Fatos estabelecidos que se contradizem',
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export default function SettingsView({ onOpenOther }: { onOpenOther: (u: Universe) => void }) {
  const ws = useWorkspace()
  const { universe, update, prefs, setPref, repo, toast, library } = ws
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [snapName, setSnapName] = useState('')
  const [forkName, setForkName] = useState('')
  const [storage, setStorage] = useState<{ persisted: boolean; usage: number; quota: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const settings = universe.settings
  const [cat, setCat] = useState<SettingsCategory>(() => {
    const wanted = (ws.nav.id ?? recall('ajustes-aba')) as SettingsCategory | null
    return SETTINGS_CATEGORIES.some((c) => c.id === wanted) ? wanted! : 'aparencia'
  })
  const [query, setQuery] = useState('')
  const choose = (c: SettingsCategory) => {
    setCat(c)
    setQuery('')
    remember('ajustes-aba', c)
  }
  const show = (id: SettingsCategory) => (query ? matches(SETTINGS_CATEGORIES.find((c) => c.id === id)!, query) : cat === id)

  const reloadSnapshots = () => void repo.listSnapshots().then(setSnapshots)
  useEffect(reloadSnapshots, [repo])
  useEffect(() => {
    void Promise.all([isStoragePersisted(), storageEstimate()]).then(([persisted, est]) => setStorage({ persisted, usage: est?.usage ?? 0, quota: est?.quota ?? 0 }))
  }, [])

  const setSetting = <K extends keyof Universe['settings']>(k: K, v: Universe['settings'][K]) => update((u) => ({ ...u, settings: { ...u.settings, [k]: v } }))

  const backup = ws.downloadBackup
  const lastBackup = prefs.backups[universe.id]?.last

  /**
   * Troca o conteúdo deste universo (restaurar/importar). Salva tudo e guarda um
   * snapshot do estado atual antes, e reabre a área de trabalho com o novo conteúdo.
   */
  const replaceWith = async (next: Universe, label: string) => {
    await ws.flush()
    await repo.createSnapshot(universe, `Antes de ${label}`)
    onOpenOther({ ...next, id: universe.id, name: universe.name, updatedAt: new Date().toISOString() })
  }

  const importFile = async (file: File, mode: 'novo' | 'substituir') => {
    try {
      const imported = migrate(JSON.parse(await file.text())).universe
      if (mode === 'novo') onOpenOther({ ...imported, id: newId(), name: `${imported.name} (importado)` })
      else await replaceWith(imported, 'importar o backup')
    } catch (err) {
      toast(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, { tone: 'erro' })
    }
  }
  const [importMode, setImportMode] = useState<'novo' | 'substituir'>('novo')

  return (
    <div className="view settings-view">
      <header className="view-head">
        <h1>Ajustes e dados</h1>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Categorias dos ajustes">
          <div className="settings-search">
            <Search size={15} aria-hidden="true" />
            <label htmlFor="ajustes-busca" className="sr-only">
              Procurar nos ajustes
            </label>
            <input id="ajustes-busca" className="input input-sm" type="search" placeholder="Procurar: tema, backup…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ul>
            {SETTINGS_CATEGORIES.map((c) => (
              <li key={c.id}>
                <button type="button" className="settings-nav-item" aria-current={!query && cat === c.id ? 'page' : undefined} onClick={() => choose(c.id)}>
                  <c.icon size={16} aria-hidden="true" />
                  <span>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

      <div className="settings-grid">
        {query && !SETTINGS_CATEGORIES.some((c) => matches(c, query)) && <p className="muted">Nada encontrado para “{query}”.</p>}
        {query && <p className="muted small settings-found">Mostrando: {SETTINGS_CATEGORIES.filter((c) => matches(c, query)).map((c) => c.label).join(', ')}</p>}
{show('universo') && (
        <section className="settings-card">
          <h2 className="section-title">Universo</h2>
          <div className="form-grid">
            <Field label="Nome" wide>
              {(id) => <input id={id} className="input" value={universe.name} onChange={(e) => update((u) => ({ ...u, name: e.target.value }))} />}
            </Field>
            <Field label="Descrição" wide>
              {(id) => <textarea id={id} className="input textarea" rows={2} value={universe.description} onChange={(e) => update((u) => ({ ...u, description: e.target.value }))} />}
            </Field>
            <Field label="Rótulo do ano" hint="Texto depois do ano: DC, da Coroa, AA…">
              {(id) => <input id={id} className="input" value={settings.calendarSuffix} onChange={(e) => setSetting('calendarSuffix', e.target.value)} />}
            </Field>
            <Field label="Meta diária de palavras" hint="0 = sem meta">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  inputMode="numeric"
                  value={settings.dailyWordGoal || ''}
                  placeholder="0"
                  onChange={(e) => setSetting('dailyWordGoal', Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                />
              )}
            </Field>
          </div>
          <CalendarEditor />
        </section>
        )}

{show('menu') && (
        <section className="settings-card">
          <h2 className="section-title">Áreas do menu</h2>
          <p className="muted small">Esconda o que você não usa. Tudo continua acessível pela busca, e nada é apagado.</p>
          <div className="area-toggles">
            {[...NAV.flatMap((g) => g.items), { view: 'inbox' as const, label: 'Inbox' }].map((item) => (
              <Toggle
                key={item.view}
                label={item.label}
                checked={!prefs.hiddenViews.includes(item.view)}
                onChange={(v) => setPref('hiddenViews', v ? prefs.hiddenViews.filter((x) => x !== item.view) : [...prefs.hiddenViews, item.view])}
              />
            ))}
          </div>
          <div className="inline-fields">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPref('hiddenViews', PRESETS.escrita)}>
              Só escrita
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPref('hiddenViews', PRESETS.rpg)}>
              Só RPG
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPref('hiddenViews', [])}>
              Mostrar tudo
            </button>
          </div>
          <p className="muted small">Quer rever para que serve cada parte da tela?</p>
          <div className="inline-fields">
            <button type="button" className="btn btn-ghost btn-sm" onClick={ws.startTour}>
              <Compass size={14} /> Refazer o tour
            </button>
          </div>
        </section>
        )}

{show('aparencia') && (
        <section className="settings-card">
          <h2 className="section-title">Aparência</h2>
          <AccentPicker value={prefs.accent} onChange={(v) => setPref('accent', v)} />
          <div className="form-grid">
            <Field label="Tema">
              {(id) => (
                <Select<Prefs['theme']>
                  id={id}
                  value={prefs.theme}
                  onChange={(v) => setPref('theme', v)}
                  options={[
                    { value: 'sistema', label: 'Seguir o sistema' },
                    { value: 'claro', label: 'Claro' },
                    { value: 'escuro', label: 'Escuro' },
                  ]}
                />
              )}
            </Field>
            <Field label="Fonte do texto">
              {(id) => (
                <Select<Prefs['editorFont']>
                  id={id}
                  value={prefs.editorFont}
                  onChange={(v) => setPref('editorFont', v)}
                  options={[
                    { value: 'serifa', label: 'Serifada (Literata)' },
                    { value: 'sem-serifa', label: 'Sem serifa' },
                  ]}
                />
              )}
            </Field>
            <Field label={`Tamanho do texto: ${prefs.editorSize}px`}>
              {(id) => <input id={id} type="range" min={15} max={26} value={prefs.editorSize} onChange={(e) => setPref('editorSize', Number(e.target.value))} />}
            </Field>
            <Field label="Largura da página">
              {(id) => (
                <Select<Prefs['editorWidth']>
                  id={id}
                  value={prefs.editorWidth}
                  onChange={(v) => setPref('editorWidth', v)}
                  options={[
                    { value: 'estreita', label: 'Estreita' },
                    { value: 'media', label: 'Média' },
                    { value: 'larga', label: 'Larga' },
                  ]}
                />
              )}
            </Field>
          </div>
          <p className="muted tiny">Tema e cor valem para este aparelho, em todos os universos. Dica: o botão de sol/lua no menu lateral troca o tema na hora.</p>
        </section>
        )}

{show('escrita') && (
        <section className="settings-card">
          <h2 className="section-title">Enquanto você escreve</h2>
          <Toggle label="Destacar nomes de fichas conhecidas" checked={prefs.detection} onChange={(v) => setPref('detection', v)} />
          <Toggle label="Procurar nomes ainda não cadastrados" checked={prefs.discovery} onChange={(v) => setPref('discovery', v)} />
          <Toggle label="Mostrar a margem viva" checked={prefs.margin} onChange={(v) => setPref('margin', v)} />
          <Toggle label="Mostrar a barra de formatação" checked={prefs.toolbar} onChange={(v) => setPref('toolbar', v)} />
          <p className="muted tiny">Tudo é opcional. Desligado, o Papirus vira um editor silencioso.</p>
        </section>
        )}

{show('escrita') && (
        <section className="settings-card">
          <h2 className="section-title">Perguntas de continuidade</h2>
          {(Object.keys(QUESTION_LABEL) as QuestionType[]).map((t) => (
            <Toggle key={t} label={QUESTION_LABEL[t]} checked={prefs.continuity[t]} onChange={(v) => setPref('continuity', { ...prefs.continuity, [t]: v })} />
          ))}
          <h3 className="section-label">Nomes ignorados pela descoberta</h3>
          {settings.ignoredNames.length === 0 ? (
            <p className="muted small">Nenhum.</p>
          ) : (
            <div className="chips">
              {settings.ignoredNames.map((n) => (
                <span key={n} className="chip">
                  {n}
                  <button type="button" className="chip-x" aria-label={`Voltar a sugerir ${n}`} onClick={() => setSetting('ignoredNames', settings.ignoredNames.filter((x) => x !== n))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
        )}

        {show('livros') && <BookCard />}

        {show('conta') && <AccountCard />}
        {show('conta') && <ServerCard />}

{show('dados') && (
        <section className="settings-card settings-data">
          <h2 className="section-title">Seus dados</h2>
          <p className="small">
            Tudo fica neste navegador. O histórico local não substitui um backup: exporte de vez em quando e guarde o arquivo em outro lugar.
          </p>
          <div className="button-stack">
            <button type="button" className="btn btn-primary" onClick={backup}>
              <FileJson size={16} /> Baixar backup completo (.json)
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => downloadText(fileNameFor(universe.name, 'md'), universeToMarkdown(universe))}>
              <Download size={16} /> Exportar manuscrito (.md)
            </button>
          </div>
          <div className="import-row">
            <Select
              label="Ao importar"
              value={importMode}
              onChange={setImportMode}
              options={[
                { value: 'novo', label: 'Abrir como um novo universo' },
                { value: 'substituir', label: 'Substituir este (guarda um snapshot antes)' },
              ]}
            />
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <FileUp size={16} /> Importar backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importFile(f, importMode)
                e.target.value = ''
              }}
            />
          </div>
          <p className="muted small">{lastBackup ? `Último backup baixado: ${dateFmt.format(new Date(lastBackup))}.` : 'Nenhum backup baixado deste universo ainda.'}</p>
          {storage && (
            <p className="muted small storage-line">
              <HardDrive size={14} aria-hidden="true" /> {formatBytes(storage.usage)} usados
              {storage.quota > 0 && ` de ${formatBytes(storage.quota)}`} ·{' '}
              {storage.persisted ? (
                'o navegador não vai apagar estes dados sozinho'
              ) : (
                <>
                  o navegador pode apagar estes dados se faltar espaço.{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={async () => {
                      const ok = await requestPersistentStorage()
                      setStorage((s) => (s ? { ...s, persisted: ok } : s))
                      toast(ok ? 'Armazenamento persistente concedido' : 'O navegador não concedeu. Faça backups.')
                    }}
                  >
                    Pedir para manter
                  </button>
                </>
              )}
            </p>
          )}
        </section>
        )}

        {show('dados') && <FolderCard />}

{show('dados') && (
        <section className="settings-card">
          <h2 className="section-title">Snapshots</h2>
          <p className="muted small">Fotografias do universo. Automáticos a cada 30 minutos de trabalho; os nomeados ficam até você apagar.</p>
          <form
            className="inline-fields"
            onSubmit={async (e) => {
              e.preventDefault()
              await ws.flush()
              await repo.createSnapshot(universe, snapName.trim() || 'Snapshot manual')
              setSnapName('')
              reloadSnapshots()
              toast('Snapshot criado')
            }}
          >
            <label htmlFor="snap-name" className="sr-only">
              Nome do snapshot
            </label>
            <input id="snap-name" className="input" placeholder="Antes de reescrever o ato 2" value={snapName} onChange={(e) => setSnapName(e.target.value)} />
            <button type="submit" className="btn btn-ghost">
              <Camera size={16} /> Criar
            </button>
          </form>
          <ul className="snapshots">
            {snapshots.map((s) => (
              <li key={s.id} className="snapshot">
                <span className="snapshot-name">{s.name}</span>
                <span className="muted small">
                  {dateFmt.format(new Date(s.at))} · {s.words.toLocaleString('pt-BR')} palavras
                </span>
                <ConfirmButton
                  className="btn btn-ghost btn-sm"
                  question="Restaurar? O estado atual vira um snapshot."
                  confirmLabel="Restaurar"
                  onConfirm={async () => {
                    try {
                      await replaceWith(await repo.readSnapshot(s.id), 'restaurar o snapshot')
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Falha ao restaurar', { tone: 'erro' })
                    }
                  }}
                >
                  <RotateCcw size={14} /> Restaurar
                </ConfirmButton>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => onOpenOther({ ...(await repo.readSnapshot(s.id)), id: newId(), name: `${universe.name} — ${s.name}` })}
                >
                  Abrir como cópia
                </button>
                <ConfirmButton
                  className="btn-icon btn-sm"
                  title="Apagar snapshot"
                  question="Apagar?"
                  confirmLabel="Apagar"
                  onConfirm={async () => {
                    await repo.deleteSnapshot(s.id)
                    reloadSnapshots()
                  }}
                >
                  <Trash2 size={14} aria-label="Apagar snapshot" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </section>
        )}

{show('universo') && (
        <section className="settings-card">
          <h2 className="section-title">E se…?</h2>
          <p className="muted small">
            Crie uma cópia isolada do universo para explorar uma realidade alternativa. O universo principal não muda.
          </p>
          <form
            className="inline-fields"
            onSubmit={async (e) => {
              e.preventDefault()
              await ws.flush()
              onOpenOther(forkUniverse(universe, `E se… ${forkName.trim() || universe.name}`))
            }}
          >
            <label htmlFor="fork-name" className="sr-only">
              Nome da realidade alternativa
            </label>
            <input id="fork-name" className="input" placeholder="Kael tivesse morrido na Queda?" value={forkName} onChange={(e) => setForkName(e.target.value)} />
            <button type="submit" className="btn btn-ghost">
              <GitBranch size={16} /> Criar ramo
            </button>
          </form>
        </section>
        )}

{show('menu') && (
        <section className="settings-card">
          <h2 className="section-title">Atalhos</h2>
          <dl className="shortcuts">
            <div><dt><Kbd>{modKey}</Kbd> <Kbd>K</Kbd></dt><dd>Buscar em tudo</dd></div>
            <div><dt><Kbd>{modKey}</Kbd> <Kbd>Shift</Kbd> <Kbd>I</Kbd></dt><dd>Capturar ideia na Inbox</dd></div>
            <div><dt><Kbd>{modKey}</Kbd> <Kbd>Shift</Kbd> <Kbd>F</Kbd></dt><dd>Modo foco</dd></div>
            <div><dt><Kbd>{modKey}</Kbd> + clique</dt><dd>Espiar a ficha de um nome no texto</dd></div>
            <div><dt><Kbd>---</Kbd></dt><dd>Separador de cena</dd></div>
            <div><dt><Kbd>{modKey}</Kbd> <Kbd>S</Kbd></dt><dd>Salvar agora (o salvamento já é automático)</dd></div>
          </dl>
        </section>
        )}

{show('perigo') && (
        <section className="settings-card settings-danger">
          <h2 className="section-title">Zona de perigo</h2>
          <ConfirmButton
            className="btn btn-danger"
            question="Apagar este universo e seus snapshots deste navegador? Baixe um backup antes."
            confirmLabel="Apagar universo"
            onConfirm={async () => {
              // Salva antes de apagar, para que nenhuma gravação pendente recrie o universo depois.
              await ws.flush()
              await library.remove(universe.id)
              ws.closeUniverse()
            }}
          >
            <Trash2 size={16} /> Apagar este universo
          </ConfirmButton>
        </section>
        )}
      </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

/** Áreas escondidas por perfil de uso. */
const PRESETS: Record<'escrita' | 'rpg', View[]> = {
  escrita: ['rpg'],
  rpg: ['organizar', 'conhecimento'],
}

function CalendarEditor() {
  const { universe, update } = useWorkspace()
  const months = universe.settings.calendarMonths
  const setMonths = (m: typeof months) => update((u) => ({ ...u, settings: { ...u.settings, calendarMonths: m } }))
  return (
    <div className="calendar-editor">
      <h3 className="section-label">Meses do calendário</h3>
      {months.length === 0 ? (
        <p className="muted small">Sem meses, as datas são “ano” e “dia do ano”. Adicione meses para escrever “12 de Neblina”.</p>
      ) : (
        <ol className="month-list">
          {months.map((m, i) => (
            <li key={i} className="month-row">
              <span className="muted tabular small">{i + 1}.</span>
              <input
                className="input input-sm"
                aria-label={`Nome do mês ${i + 1}`}
                value={m.name}
                onChange={(e) => setMonths(months.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <YearInput label={`Dias do mês ${i + 1}`} value={m.days} onChange={(v) => v !== null && v > 0 && setMonths(months.map((x, j) => (j === i ? { ...x, days: v } : x)))} />
              <span className="muted tiny">dias</span>
              <button type="button" className="btn-icon btn-sm" aria-label={`Remover ${m.name}`} onClick={() => setMonths(months.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="inline-fields">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonths([...months, { name: `Mês ${months.length + 1}`, days: 30 }])}>
          + Mês
        </button>
        {months.length > 0 && <span className="muted tiny">{daysInYear(months)} dias no ano</span>}
      </div>
    </div>
  )
}

function FolderCard() {
  const { folder } = useWorkspace()
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' })
  return (
    <section className="settings-card">
      <h2 className="section-title">
        <FolderOpen size={17} aria-hidden="true" /> Pasta no computador
      </h2>
      {!folder.supported ? (
        <p className="small">
          Este navegador não permite salvar numa pasta. No Chrome, Edge ou Opera, o Papirus mantém uma cópia do universo numa pasta sua (Dropbox, Drive, Git…). Aqui, use o
          backup em JSON.
        </p>
      ) : folder.name ? (
        <>
          <p className="small">
            Salvando em <strong>{folder.name}</strong>
            {folder.state === 'ok' && folder.lastSync && ` · atualizada às ${timeFmt.format(new Date(folder.lastSync))}`}
            {folder.state === 'escrevendo' && ' · salvando…'}
            {folder.state === 'pendente' && ' · precisa de permissão de novo'}
          </p>
          {folder.error && (
            <p className="notice notice-error small" role="alert">
              {folder.error}
            </p>
          )}
          <div className="inline-fields">
            {folder.state === 'pendente' ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void folder.reconnect()}>
                Reconectar
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void folder.syncNow()}>
                Salvar agora
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void folder.connect()}>
              Trocar pasta
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void folder.disconnect()}>
              Parar de salvar na pasta
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small">
            Mantenha uma cópia sempre atualizada numa pasta do computador: o backup completo, cada cena em Markdown e cada ficha num arquivo. Se o navegador perder os dados,
            é só reabrir a pasta.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void folder.connect()}>
            <FolderOpen size={16} /> Escolher pasta
          </button>
        </>
      )}
    </section>
  )
}
