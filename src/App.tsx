import { useCallback, useEffect, useRef, useState } from 'react'
import { isOutdatedSample, sampleFor, sampleUniverse } from './model/sample'
import type { Universe } from './model/schema'
import { Library, type LibraryEntry } from './persistence/repository'
import { memoryStore, openBestStore, requestPersistentStorage } from './persistence/storage'
import { fetchByLink, openShared, parseReadLink, shortName, type SharedWithMe } from './share/sharing'
import { ReaderView } from './reader/ReaderView'
import { commentSender } from './share/feedback'
import type { LiveSource } from './share/useLiveSync'
import { authClient } from './account/auth'
import { LibraryScreen } from './shell/LibraryScreen'
import { WorkspaceShell } from './shell/WorkspaceShell'
import { accountServer, startAccount, useAccount } from './account/auth'
import { syncLibrary } from './account/useCloud'
import { remember, usePrefs } from './state/prefs'
import type { View } from './state/workspace'
import { backState, leavePage, navigateTo, onBackNavigate } from './shell/backStack'

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
      navigateTo({ u: universe.id })
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

  /** Abre um universo. `step`: novo passo no "voltar" (vindo da lista), troca o atual (ao iniciar) ou nenhum (veio do próprio "voltar"). */
  // "Voltar" do aparelho entre a lista de universos e um universo (dentro do universo, quem cuida é a área de trabalho).
  const openedId = opened?.universe.id ?? null
  const openedRef = useRef<string | null>(null)
  useEffect(() => {
    openedRef.current = openedId
  }, [openedId])

  const open = useCallback(async (lib: Library, id: string, step: 'novo' | 'trocar' | 'nenhum' = 'novo', view?: View) => {
    try {
      const repo = lib.repository(id)
      let universe = await repo.load()
      if (!universe) throw new Error('Este universo não foi encontrado neste navegador.')
      // Exemplo de uma versão antiga do Papirus: troca pelo atual (nada nele é do autor).
      if (isOutdatedSample(universe)) {
        universe = { ...(await sampleUniverse()), id: universe.id }
        await repo.save(universe)
        await lib.touch(universe)
      }
      remember('ultimo-universo', id)
      if (step !== 'nenhum') navigateTo(view ? { u: id, view } : { u: id }, step === 'trocar')
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
        const which = new URLSearchParams(location.search).get('exemplo')
        if (which !== null) {
          history.replaceState(null, '', location.pathname)
          const sample = await sampleFor(which)
          await lib.repository(sample.id).save(sample)
          await lib.touch(sample)
          setEntries(await lib.list())
          await open(lib, sample.id, 'trocar')
          return
        }
        // O Android fechou o app em segundo plano (ou a página recarregou): volta para o mesmo universo.
        // Abrir o app de novo começa no início, com os setores e o "continuar" de cada um.
        const back = backState()
        // Link de perfil (?perfil=) mostra a página da pessoa, não o último universo.
        if (back.u && list.some((e) => e.id === back.u) && !new URLSearchParams(location.search).has('perfil')) await open(lib, back.u, 'trocar')
        void requestPersistentStorage()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // "Voltar" para a lista de universos, ou para outro universo aberto antes.
  useEffect(() => {
    if (!library) return
    return onBackNavigate((p) => {
      if (p.u === openedRef.current) return
      if (p.u === null) {
        remember('ultimo-universo', null)
        setOpened(null)
        // A área de trabalho grava o que faltava ao fechar; a lista é lida de novo depois.
        void refresh(library)
        setTimeout(() => void refresh(library), 600)
        return
      }
      const id = p.u
      void library.list().then((list) => {
        if (list.some((e) => e.id === id)) void open(library, id, 'nenhum')
        else {
          setOpened(null)
          void refresh(library)
        }
      })
    })
  }, [library, open, refresh])

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
        onOpen={(id, view) => void open(library, id, 'novo', view)}
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
          onComment={commentSender(opened.source ?? { kind: 'proprio' }, opened.universe.id, null)}
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
          leavePage(location.pathname)
          return
        }
        remember('ultimo-universo', null)
        navigateTo({ u: null })
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
