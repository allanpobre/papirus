import { useCallback, useEffect, useState } from 'react'
import { sampleUniverse } from './model/sample'
import type { Universe } from './model/schema'
import { Library, type LibraryEntry } from './persistence/repository'
import { openBestStore, requestPersistentStorage } from './persistence/storage'
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

  const open = useCallback(async (lib: Library, id: string) => {
    try {
      const repo = lib.repository(id)
      const universe = await repo.load()
      if (!universe) throw new Error('Este universo não foi encontrado neste navegador.')
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
        if (last && list.some((e) => e.id === last)) await open(lib, last)
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
        <h1>Não foi possível abrir seus dados</h1>
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
      />
    )
  }

  return (
    <WorkspaceShell
      key={`${opened.universe.id}:${opened.nonce}`}
      library={library}
      initial={opened.universe}
      recovered={opened.recovered}
      prefsApi={prefsApi}
      onClose={async () => {
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
