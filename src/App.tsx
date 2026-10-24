import { useCallback, useEffect, useState } from 'react'
import { isOutdatedSample, sampleUniverse } from './model/sample'
import type { Universe } from './model/schema'
import { Library, type LibraryEntry } from './persistence/repository'
import { memoryStore, openBestStore, requestPersistentStorage } from './persistence/storage'
import { fetchByLink, openShared, parseReadLink, shortName, type SharedWithMe } from './share/sharing'
import { ReaderView } from './reader/ReaderView'
import type { LiveSource } from './share/useLiveSync'
import { authClient } from './account/auth'
import { LibraryScreen } from './shell/LibraryScreen'
import { WorkspaceShell } from './shell/WorkspaceShell'
import { accountServer, startAccount, useAccount } from './account/auth'
import { syncLibrary } from './account/useCloud'
import { recall, remember, usePrefs } from './state/prefs'

interface Opened {
  universe: Universe
  recovered: boolean
  /** Muda a cada abertura, para remontar a área de trabalho mesmo com o mesmo universo. */
  nonce: number
  /** Universo de outra pessoa (ou pelo link): fica só na memória, nunca na biblioteca daqui. */
  source?: LiveSource
  memory?: Library
  /** Link "como livro": só o modo leitor, sem a área de trabalho. */
  book?: { key: string; ownerEmail: string }
}

/** Guarda um universo de fora numa biblioteca só de memória. */
async function inMemory(universe: Universe): Promise<Library> {
  const lib = new Library(memoryStore())
  await lib.repository(universe.id).save(universe)
  await lib.touch(universe)
  return lib
}

export default function App() {
  const prefsApi = usePrefs()
  const [library, setLibrary] = useState<Library | null>(null)
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (lib: Library) => setEntries(await lib.list()), [])
  const account = useAccount()
  const server = accountServer(prefsApi.prefs)

  // Liga a conta ao servidor configurado (ou desliga, se não houver).
  useEffect(() => {
    void startAccount(server)
  }, [server])

  // Com conta e na biblioteca: sincroniza e mostra o que chegou de outros aparelhos.
  const userId = account.user?.id
  const inLibrary = !opened
  useEffect(() => {
    if (!library || !userId || !account.server || !inLibrary) return
    void syncLibrary(library, account.server, userId).then((r) => r && refresh(library))
  }, [library, userId, account.server, inLibrary, refresh])

  const openFromShare = useCallback(async (item: SharedWithMe) => {
    if (!account.server) return
    try {
      const sb = await authClient(account.server)
      const { universe, stamp } = await openShared(sb, item)
      setOpened({
        universe,
        recovered: false,
        nonce: Date.now(),
        memory: await inMemory(universe),
        source: { kind: item.role, ownerId: item.owner_id, ownerEmail: item.owner_email, stamp },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [account.server])

  const open = useCallback(async (lib: Library, id: string) => {
    try {
      const repo = lib.repository(id)
      let universe = await repo.load()
      if (!universe) throw new Error('Este universo não foi encontrado neste navegador.')
      // Exemplo de uma versão antiga do Papirus: troca pelo atual (nada nele é do autor).
      if (isOutdatedSample(universe)) {
        universe = { ...sampleUniverse(), id: universe.id }
        await repo.save(universe)
        await lib.touch(universe)
      }
      remember('ultimo-universo', id)
      setOpened({ universe, recovered: repo.recoveredFromEmergency, nonce: Date.now() })
    } catch (err) {
      // Nunca sobrescreve dados que não conseguimos ler.
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Link de leitura (?ler=…): abre só aquele universo, sem tocar na biblioteca daqui.
      const link = parseReadLink(location.search)
      if (link) {
        try {
          if (!link.server) throw new Error('Este link de leitura está incompleto. Peça o link de novo a quem compartilhou.')
          const got = await fetchByLink(link.server, link.token)
          if (cancelled) return
          if (!got) throw new Error('Este link de leitura foi desligado ou trocado. Peça um novo a quem compartilhou.')
          const memory = await inMemory(got.universe)
          setLibrary(memory)
          setEntries([])
          setOpened({
            universe: got.universe,
            recovered: false,
            nonce: Date.now(),
            memory,
            source: { kind: 'link', token: link.token, stamp: got.stamp, server: link.server, ownerEmail: got.ownerEmail },
            book: link.mode === 'livro' ? { key: `leitor:link:${link.token.slice(0, 16)}`, ownerEmail: got.ownerEmail } : undefined,
          })
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err))
        }
        return
      }
      const store = await openBestStore()
      const lib = new Library(store, safeLocalStorage())
      try {
        const list = await lib.list()
        if (cancelled) return
        setLibrary(lib)
        setEntries(list)
        // "Ver um mundo de exemplo" na apresentação: abre o exemplo (uma vez; o endereço volta ao normal).
        if (new URLSearchParams(location.search).has('exemplo')) {
          history.replaceState(null, '', location.pathname)
          const sample = sampleUniverse()
          await lib.repository(sample.id).save(sample)
          await lib.touch(sample)
          setEntries(await lib.list())
          await open(lib, sample.id)
          return
        }
        const last = recall('ultimo-universo')
        // Link de perfil (?perfil=) mostra a página da pessoa, não o último universo.
        if (last && list.some((e) => e.id === last) && !new URLSearchParams(location.search).has('perfil')) await open(lib, last)
        void requestPersistentStorage()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (error) {
    return (
      <main className="fatal" role="alert">
        <h1>{parseReadLink(location.search) ? 'Não foi possível abrir este link' : 'Não foi possível abrir seus dados'}</h1>
        <p>{error}</p>
        <p>Nada foi apagado nem sobrescrito.</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </main>
    )
  }

  if (!library || !entries) {
    return (
      <main className="loading" aria-busy="true">
        <span className="brand-mark" aria-hidden="true" />
        Abrindo seus papéis…
      </main>
    )
  }

  if (!opened) {
    return (
      <LibraryScreen
        library={library}
        entries={entries}
        prefs={prefsApi}
        onOpen={(id) => void open(library, id)}
        onCreated={async (u) => {
          await library.repository(u.id).save(u)
          await library.touch(u)
          await refresh(library)
          await open(library, u.id)
        }}
        onChanged={() => void refresh(library)}
        onOpenShared={(item) => void openFromShare(item)}
      />
    )
  }

  if (opened.book) {
    return (
      <main className="leitor-app">
        <ReaderView
          universe={opened.universe}
          storageKey={opened.book.key}
          footer={
            <p className="leitor-made muted tiny">
              Compartilhado {opened.book.ownerEmail ? `por ${shortName(opened.book.ownerEmail)} ` : ''}com o <a href="../">Papirus</a>. O caderno guarda só o que você já leu.
            </p>
          }
        />
      </main>
    )
  }

  return (
    <WorkspaceShell
      key={`${opened.universe.id}:${opened.nonce}`}
      library={opened.memory ?? library}
      source={opened.source}
      initial={opened.universe}
      recovered={opened.recovered}
      prefsApi={prefsApi}
      onClose={async () => {
        if (opened.source?.kind === 'link') {
          location.href = location.pathname
          return
        }
        remember('ultimo-universo', null)
        setOpened(null)
        await refresh(library)
      }}
      onOpenOther={async (u) => {
        await library.repository(u.id).save(u)
        await library.touch(u)
        await refresh(library)
        await open(library, u.id)
      }}
    />
  )
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
