import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { cloudStamp, download, setSynced, syncedMap, upload, uploadIfUnchanged } from '../account/cloud'
import { reportCloud } from '../account/useCloud'
import type { Universe } from '../model/schema'
import { newId } from '../model/universe'
import type { Library } from '../persistence/repository'
import type { SaveStatus } from '../persistence/useUniverse'
import { mergeUniverse, stableJson } from './merge'
import { anonClient, type ServerConfig } from './server'
import { fetchByLink, getShare, onShareChanged, openShared, refreshReaderCopy, saveShared, sharedStamp, shortName, type Share } from './sharing'

/**
 * De onde vem o universo aberto:
 * - `proprio`: deste navegador (com conta, também vai para a nuvem);
 * - `editar` / `ver`: de outra pessoa, compartilhado com a conta;
 * - `link`: pelo link de leitura, sem conta.
 */
export type LiveSource =
  | { kind: 'proprio' }
  | { kind: 'editar' | 'ver'; ownerId: string; ownerEmail: string; stamp: string }
  | { kind: 'link'; token: string; stamp: string; server: ServerConfig; ownerEmail: string }

export const isReadOnly = (s: LiveSource) => s.kind === 'ver' || s.kind === 'link'

/** Outra pessoa com o mesmo universo aberto agora. */
export interface Presence {
  key: string
  who: string
  sceneId: string | null
}

interface Options {
  lib: Library
  universe: Universe
  status: SaveStatus
  source: LiveSource
  /** Cena aberta no editor (para o aviso "Fulano está editando esta cena"). */
  sceneId: string | null
  /** Troca o universo aberto pelo que chegou de fora, sem passar pelo "só leitura". */
  applyRemote: (u: Universe, changedScenes: string[]) => void
  notify: (message: string, tone?: 'info' | 'erro') => void
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))
/** O servidor devolve as datas em outro formato ("+00:00" no lugar de "Z"): compara o instante. */
const sameTime = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && Date.parse(a) === Date.parse(b))
const POLL_MS = { proprio: 20_000, editar: 6_000, ver: 12_000, link: 15_000 }

/**
 * Mantém o universo aberto igual ao do servidor, nos dois sentidos, registro por registro:
 * o que chega de outra pessoa (ou aparelho) é juntado com o que se escreve aqui.
 * Também mostra quem mais está com o universo aberto.
 */
export function useLiveSync({ lib, universe, status, source, sceneId, applyRemote, notify }: Options): Presence[] {
  const account = useAccount()
  const [others, setOthers] = useState<Presence[]>([])
  const latest = useRef(universe)
  const cb = useRef({ applyRemote, notify })
  const scene = useRef(sceneId)
  const othersRef = useRef(others)
  useEffect(() => {
    latest.current = universe
    cb.current = { applyRemote, notify }
    scene.current = sceneId
    othersRef.current = others
  })

  // O que está no servidor, até onde sabemos: a base para juntar mudanças.
  const base = useRef<Universe | null>(null)
  const stamp = useRef<string | null>(null)
  const [initialSource] = useState(source)
  const userId = account.user?.id
  const userEmail = account.user?.email ?? ''
  const server = source.kind === 'link' ? source.server : account.server
  const ownerId = source.kind === 'proprio' ? userId : source.kind === 'link' ? null : source.ownerId
  const active = source.kind === 'link' || Boolean(userId && server)
  const started = useRef(false)

  const run = useRef<() => Promise<void>>(async () => {})
  const channel = useRef<RealtimeChannel | null>(null)
  const share = useRef<Share | null | undefined>(undefined)

  useEffect(() => {
    if (!active || !server) return
    let stopped = false
    let busy = false
    let again = false
    const universeId = latest.current.id
    const who = shortName(userEmail) || 'alguém'
    // Só na primeira vez: depois, a base é o que já foi trocado com o servidor.
    if (!started.current) {
      started.current = true
      if (initialSource.kind !== 'proprio') {
        base.current = latest.current
        stamp.current = initialSource.stamp
      } else if (userId && sameTime(syncedMap(userId)[universeId], latest.current.updatedAt)) {
        base.current = latest.current
        stamp.current = latest.current.updatedAt
      }
    }
    // Quem mudou do outro lado: se só uma pessoa está com o universo aberto, é ela.
    const otherName = (fallback: string) => (othersRef.current.length === 1 ? othersRef.current[0].who : fallback)

    const client = (): Promise<SupabaseClient> => (initialSource.kind === 'link' ? anonClient(server) : authClient(server))
    const ping = () => {
      // Só pelo canal já aberto; sem ele, os outros recebem pela checagem periódica.
      const ch = channel.current
      if (ch?.state === 'joined') void ch.send({ type: 'broadcast', event: 'mudou', payload: {} }).catch(() => undefined)
    }

    /** Recebe o que mudou lá fora e junta com o que está aqui. */
    const receive = (theirs: Universe, remoteStamp: string, from: string) => {
      const mine = latest.current
      if (isReadOnly(initialSource) || !base.current) {
        const mineScenes = new Map(mine.scenes.map((s) => [s.id, stableJson(s.doc)]))
        cb.current.applyRemote(theirs, theirs.scenes.filter((s) => mineScenes.get(s.id) !== stableJson(s.doc)).map((s) => s.id))
        // Já vale daqui em diante, antes mesmo da tela redesenhar (o envio logo abaixo usa esta).
        latest.current = theirs
      } else {
        const r = mergeUniverse(base.current, mine, theirs, from)
        if (r.universe !== mine) {
          cb.current.applyRemote(r.universe, r.changedScenes)
          latest.current = r.universe
        }
        if (r.copies.length) {
          cb.current.notify(
            `${from} mexeu ao mesmo tempo em ${r.copies.length === 1 ? `“${r.copies[0]}”` : `${r.copies.length} itens`}. A versão de ${from} foi guardada ao lado, com “(versão de ${from})” no nome.`,
            'erro',
          )
        }
      }
      base.current = theirs
      stamp.current = remoteStamp
    }

    const tick = async () => {
      if (stopped) return
      if (busy) {
        again = true
        return
      }
      busy = true
      try {
        const sb = await client()
        if (initialSource.kind === 'link') {
          const got = await fetchByLink(server, initialSource.token)
          if (!got) {
            cb.current.notify('O dono desligou este link de leitura.', 'erro')
            stopped = true
          } else if (!sameTime(got.stamp, stamp.current)) receive(got.universe, got.stamp, shortName(got.ownerEmail))
          return
        }
        if (initialSource.kind === 'ver') {
          const remote = await sharedStamp(sb, { owner_id: initialSource.ownerId, universe_id: universeId, role: 'ver' })
          if (!remote) {
            cb.current.notify('Este universo não está mais compartilhado com você.', 'erro')
            stopped = true
          } else if (!sameTime(remote, stamp.current)) {
            const got = await openShared(sb, { owner_id: initialSource.ownerId, universe_id: universeId, role: 'ver' })
            receive(got.universe, got.stamp, shortName(initialSource.ownerEmail))
          }
          return
        }

        // Quem escreve: primeiro recebe, depois envia.
        const owner = ownerId!
        const isOwner = initialSource.kind === 'proprio'
        reportCloud({ state: 'sincronizando' })
        const row = isOwner ? await cloudStamp(sb, owner, universeId) : { updated_at: await sharedStamp(sb, { owner_id: owner, universe_id: universeId, role: 'editar' }), deleted: false }
        if (!isOwner && !row?.updated_at) {
          cb.current.notify('Seu acesso a este universo foi tirado. Nada do que você fez aqui foi salvo lá.', 'erro')
          stopped = true
          return
        }
        const remote = row?.deleted ? null : (row?.updated_at ?? null)
        const from = otherName(isOwner ? 'outra pessoa' : shortName(initialSource.kind === 'editar' ? initialSource.ownerEmail : '') || 'outra pessoa')
        if (remote && !sameTime(remote, stamp.current) && !sameTime(remote, latest.current.updatedAt)) {
          const theirs = isOwner ? await download(sb, owner, universeId) : (await openShared(sb, { owner_id: owner, universe_id: universeId, role: 'editar' })).universe
          if (base.current) receive(theirs, remote, from)
          else {
            // Sem base conhecida (nunca sincronizou daqui): a versão de lá vira uma cópia, como antes.
            const copy = { ...theirs, id: newId(), name: `${theirs.name} (versão da nuvem)` }
            await lib.repository(copy.id).save(copy)
            await lib.touch(copy)
            cb.current.notify(`Este universo também mudou em outro aparelho. A versão de lá foi guardada como “${copy.name}”.`, 'erro')
            base.current = theirs
            stamp.current = remote
          }
        } else if (remote && !stamp.current) {
          stamp.current = remote
        }

        const mine = latest.current
        if (base.current && sameTime(base.current.updatedAt, mine.updatedAt) && remote) {
          reportCloud({ state: 'ok', at: new Date().toISOString() })
          return
        }
        let wrote: boolean
        if (isOwner && !remote) {
          await upload(sb, owner, mine)
          wrote = true
        } else if (isOwner) {
          wrote = await uploadIfUnchanged(sb, owner, mine, remote!)
        } else {
          wrote = await saveShared(sb, owner, mine, remote!)
        }
        if (!wrote) {
          // Alguém gravou entre a leitura e a escrita: junta de novo.
          again = true
          return
        }
        if (isOwner) setSynced(owner, universeId, mine.updatedAt)
        base.current = mine
        stamp.current = mine.updatedAt
        if (share.current === undefined) share.current = await getShare(sb, owner, universeId).catch(() => null)
        if (share.current) await refreshReaderCopy(sb, share.current, mine).catch(() => undefined)
        ping()
        reportCloud({ state: 'ok', at: new Date().toISOString() })
      } catch (err) {
        if (initialSource.kind !== 'ver' && initialSource.kind !== 'link') reportCloud({ state: 'erro', error: message(err) })
      } finally {
        busy = false
        if (again && !stopped) {
          again = false
          setTimeout(() => void tick(), 300)
        }
      }
    }
    run.current = tick

    // Avisos na hora (quando outra pessoa grava) e quem está com o universo aberto.
    const presenceKey = newId()
    void client().then((sb) => {
      if (stopped) return
      const ch = sb.channel(`papirus-u-${universeId}`, { config: { presence: { key: presenceKey } } })
      ch.on('broadcast', { event: 'mudou' }, () => void tick())
        .on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState<{ who: string; sceneId: string | null }>()
          setOthers(
            Object.entries(state)
              .filter(([k]) => k !== presenceKey)
              .map(([k, metas]) => ({ key: k, who: metas[0]?.who ?? 'alguém', sceneId: metas[0]?.sceneId ?? null })),
          )
        })
        .subscribe((s) => {
          if (s === 'SUBSCRIBED' && !isReadOnly(initialSource)) void ch.track({ who, sceneId: scene.current })
        })
      channel.current = ch
    })

    // Checagem periódica (caso o aviso na hora falhe). Universo próprio e compartilhado: mais seguido.
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = () => {
      const ms = initialSource.kind === 'proprio' && share.current ? POLL_MS.editar : POLL_MS[initialSource.kind]
      timer = setTimeout(() => void tick().finally(() => !stopped && loop()), ms)
    }
    void (async () => {
      if (initialSource.kind === 'proprio' && ownerId) share.current = await getShare(await client(), ownerId, universeId).catch(() => null)
      await tick()
      if (!stopped) loop()
    })()
    const offShare = onShareChanged(() => {
      share.current = undefined
      void (async () => {
        if (ownerId) share.current = await getShare(await client(), ownerId, universeId).catch(() => null)
        // Força o envio: a cópia de leitura pode precisar ser refeita.
        if (share.current) await refreshReaderCopy(await client(), share.current, latest.current).catch(() => undefined)
        ping()
      })()
    })
    return () => {
      offShare()
      stopped = true
      clearTimeout(timer)
      const ch = channel.current
      channel.current = null
      if (ch) void client().then((sb) => sb.removeChannel(ch))
    }
  }, [active, server, userId, userEmail, ownerId, initialSource, lib])

  // Depois de cada salvamento aqui, envia (com uma pausa curta).
  useEffect(() => {
    if (!active || isReadOnly(initialSource) || status !== 'salvo') return
    const t = setTimeout(() => void run.current(), 1500)
    return () => clearTimeout(t)
  }, [active, initialSource, status, universe.updatedAt])

  // Conta qual cena está aberta aqui.
  useEffect(() => {
    if (!active || isReadOnly(initialSource)) return
    const ch = channel.current
    if (ch) void ch.track({ who: shortName(userEmail) || 'alguém', sceneId }).catch(() => undefined)
  }, [active, initialSource, sceneId, userEmail])

  return others
}
