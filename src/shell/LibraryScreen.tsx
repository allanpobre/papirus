import { BookOpen, Cloud, Dices, Feather, FileUp, FolderOpen, HardDrive, Map as MapIcon, Moon, Plus, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react'
import { AccountButton, AccountDialog } from '../account/AccountDialog'
import { authClient, useAccount } from '../account/auth'
import { removeFromCloud, syncedMap } from '../account/cloud'
import { useCloudStatus } from '../account/useCloud'
import { useRef, useState } from 'react'
import { migrate } from '../model/migrations'
import { sampleUniverse } from '../model/sample'
import type { Universe } from '../model/schema'
import { createUniverse, newId } from '../model/universe'
import type { Library, LibraryEntry } from '../persistence/repository'
import { readBackupFromFolder, pickFolder, supportsFolders } from '../persistence/folder'
import type { usePrefs } from '../state/prefs'
import type { View } from '../state/workspace'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Brand } from './Brand'

interface Props {
  library: Library
  entries: LibraryEntry[]
  prefs: ReturnType<typeof usePrefs>
  onOpen: (id: string) => void
  onCreated: (u: Universe) => void
  onChanged: () => void
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function LibraryScreen({ library, entries, prefs, onOpen, onCreated, onChanged }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { prefs: p, setPref } = prefs
  const dark = p.theme === 'escuro' || (p.theme === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  const account = useAccount()
  const cloud = useCloudStatus()
  const synced = account.user ? syncedMap(account.user.id) : {}
  const first = entries.length === 0

  const importFile = async (file: File) => {
    setError(null)
    try {
      const file_ = migrate(JSON.parse(await file.text()))
      let u = file_.universe
      // Importar nunca sobrescreve: se o ID já existe, vira uma cópia.
      if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (importado)` }
      onCreated(u)
    } catch (err) {
      setError(`Não foi possível importar “${file.name}”: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const start = (
    <>
      <form
        className="library-new"
        onSubmit={(e) => {
          e.preventDefault()
          onCreated(createUniverse(name.trim() || 'Novo universo'))
          setName('')
        }}
      >
        <label htmlFor="novo-universo" className="sr-only">
          Nome do novo universo
        </label>
        <input id="novo-universo" className="input input-lg" placeholder="Nome do novo universo" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg">
          <Plus size={18} /> Criar universo
        </button>
      </form>

      <div className="library-alt">
        <button type="button" className="btn btn-ghost" onClick={() => onCreated(sampleUniverse())}>
          <Sparkles size={16} /> Abrir um universo de exemplo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} /> Importar backup (.json)
        </button>
        {supportsFolders() && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              setError(null)
              try {
                const dir = await pickFolder('read')
                const file_ = migrate(await readBackupFromFolder(dir))
                let u = file_.universe
                if (entries.some((e) => e.id === u.id)) u = { ...u, id: newId(), name: `${u.name} (da pasta)` }
                onCreated(u)
              } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return
                setError(`Não foi possível abrir a pasta: ${err instanceof Error ? err.message : String(err)}`)
              }
            }}
          >
            <FolderOpen size={16} /> Abrir de uma pasta
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </>
  )

  return (
    <div className={`library${first ? ' library-first' : ''}`}>
      <header className="library-top">
        <Brand />
        <div className="library-top-actions">
          <button type="button" className="btn-icon" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setPref('theme', dark ? 'claro' : 'escuro')}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <AccountButton onClick={() => setAccountOpen(true)} />
        </div>
      </header>

      {first ? (
        <main className="landing">
          <section className="landing-hero">
            <div className="landing-copy">
              <p className="eyebrow">Para quem escreve e para quem mestra</p>
              <h1>Seu mundo, escrito e jogado no mesmo caderno.</h1>
              <p className="lede">
                Escreva a história como sempre. O Papirus percebe os nomes, guarda fichas, datas e segredos, e na mesa de RPG mostra aos jogadores só o que você revelar. Nada é obrigatório.
              </p>
              {start}
              {!p.onboarded && <Welcome onChoose={(hidden) => { setPref('hiddenViews', hidden); setPref('onboarded', true) }} />}
              <p className="landing-note small">
                <ShieldCheck size={15} aria-hidden="true" /> Sem cadastro: tudo fica neste navegador. Com uma conta (opcional), seus universos aparecem em todos os seus aparelhos.
              </p>
            </div>
            <ManuscriptPreview />
          </section>

          <section className="landing-features" aria-label="O que dá para fazer">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="feature">
                <Icon size={20} aria-hidden="true" />
                <h2>{title}</h2>
                <p>{text}</p>
              </article>
            ))}
          </section>
        </main>
      ) : (
        <main className="library-main">
          <section className="library-hero">
            <h1>Seus universos</h1>
            {account.user ? (
              <p className="library-cloud small" role="status">
                <Cloud size={14} aria-hidden="true" />{' '}
                {cloud.state === 'sincronizando'
                  ? 'Sincronizando com a sua conta…'
                  : cloud.state === 'erro'
                    ? `Não sincronizou: ${cloud.error}`
                    : `Na sua conta (${account.user.email}).`}
              </p>
            ) : (
              <p className="lede">Tudo fica guardado neste navegador. Entre numa conta para levar seus universos para outros aparelhos, ou exporte um backup de vez em quando.</p>
            )}
          </section>

          {!p.onboarded && <Welcome onChoose={(hidden) => { setPref('hiddenViews', hidden); setPref('onboarded', true) }} />}

          {start}

          <ul className="library-list" aria-label="Universos">
            {entries.map((e) => (
              <li key={e.id} className="library-item">
                <button type="button" className="library-open" onClick={() => onOpen(e.id)}>
                  <BookOpen size={20} aria-hidden="true" />
                  <span className="library-name">{e.name || 'Sem nome'}</span>
                  <span className="library-meta">
                    {e.words.toLocaleString('pt-BR')} palavras · {dateFmt.format(new Date(e.updatedAt))}
                    {account.user && (synced[e.id] ? ' · na conta' : ' · só neste aparelho')}
                  </span>
                </button>
                <ConfirmButton
                  className="btn-icon"
                  title={`Apagar ${e.name}`}
                  question={account.user ? 'Apagar de vez este universo, aqui e na sua conta?' : 'Apagar de vez este universo e seus snapshots?'}
                  confirmLabel="Apagar universo"
                  onConfirm={async () => {
                    await library.remove(e.id)
                    if (account.user && account.server && synced[e.id]) {
                      try {
                        await removeFromCloud(await authClient(account.server), account.user.id, e.id)
                      } catch (err) {
                        setError(`Apagado aqui, mas não na conta: ${err instanceof Error ? err.message : String(err)}`)
                      }
                    }
                    onChanged()
                  }}
                >
                  <Trash2 size={16} aria-label={`Apagar ${e.name}`} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </main>
      )}

      {accountOpen && <AccountDialog library={library} prefs={p} setPref={setPref} onClose={() => setAccountOpen(false)} onSynced={onChanged} />}
    </div>
  )
}

const FEATURES = [
  { icon: Feather, title: 'Escrever', text: 'Editor limpo, nomes viram fichas quando você quiser, comentários, versões e livros em Word ou EPUB.' },
  { icon: MapIcon, title: 'Construir o mundo', text: 'Fichas, relações, linha do tempo com calendário próprio, mapas com marcadores e mentiras que os personagens acreditam.' },
  { icon: Dices, title: 'Mestrar', text: 'Qualquer sistema, ou o seu. Sessões, iniciativa, fichas de jogo e o Codex ao vivo no celular dos jogadores.' },
  { icon: HardDrive, title: 'Seus dados, suas regras', text: 'Funciona sem internet e sem cadastro. Backup, pasta no computador ou conta na nuvem: você escolhe.' },
]

/** Uma página de manuscrito de exemplo: o que o Papirus faz com o texto, sem precisar explicar. */
function ManuscriptPreview() {
  return (
    <figure className="landing-page" aria-label="Exemplo: uma cena com nomes reconhecidos e uma ficha na margem">
      <div className="landing-sheet">
        <p className="landing-scene">A chegada · ano 359 DC</p>
        <p>
          Era noite em <span className="landing-name">Ostria</span> quando o homem pálido desceu do navio. <span className="landing-name">Kael</span> o viu primeiro, da sombra das redes.
        </p>
        <p>
          Mais tarde, na taverna, <span className="landing-name">Mira</span> jurou que ele tinha <mark className="landing-fact">olhos cinzentos</mark>.
        </p>
      </div>
      <aside className="landing-margin" aria-hidden="true">
        <p className="landing-card">
          <strong>Kael</strong>
          <span>Personagem · em 3 cenas</span>
        </p>
        <p className="landing-card landing-card-fact">
          <strong>Fato guardado</strong>
          <span>Vaelor tem olhos cinzentos, segundo Mira</span>
        </p>
        <p className="landing-card landing-card-codex">
          <strong>Codex da mesa</strong>
          <span>3 jogadores veem · 1 segredo guardado</span>
        </p>
      </aside>
    </figure>
  )
}

/** Primeira visita: como a pessoa vai usar o Papirus, para ajustar o menu. Pode ser mudado depois. */
function Welcome({ onChoose }: { onChoose: (hiddenViews: View[]) => void }) {
  return (
    <section className="welcome" aria-label="Boas-vindas">
      <p className="welcome-title">Vou usar para:</p>
      <div className="welcome-options">
        <button type="button" className="welcome-option" onClick={() => onChoose(['rpg'])}>
          <Feather size={16} aria-hidden="true" /> Escrever histórias
        </button>
        <button type="button" className="welcome-option" onClick={() => onChoose(['organizar', 'conhecimento'])}>
          <Dices size={16} aria-hidden="true" /> Mestrar RPG
        </button>
        <button type="button" className="welcome-option" onClick={() => onChoose([])}>
          <BookOpen size={16} aria-hidden="true" /> Os dois
        </button>
      </div>
      <p className="muted tiny">Só arruma o menu. Tudo continua disponível e dá para mudar em Ajustes.</p>
    </section>
  )
}
