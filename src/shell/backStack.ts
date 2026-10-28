import type { View } from '../state/workspace'

/**
 * O "voltar" do aparelho (botão ou gesto do Android, e o voltar do navegador).
 *
 * Cada tela aberta vira um passo no histórico do navegador, e cada janela por cima
 * (busca, ficha espiada, Oficina…) também. Voltar fecha a janela de cima; sem janela
 * aberta, volta para a tela anterior; no começo de tudo, sai do app, como em qualquer app.
 *
 * O passo atual também guarda onde a pessoa está (universo, tela, ficha ou cena):
 * se o Android fechar o app em segundo plano, ao reabrir ele volta para o mesmo lugar.
 */
export interface Place {
  /** Universo aberto (`null` = lista de universos). */
  u: string | null
  view?: View
  id?: string | null
}

export interface BackState extends Place {
  /** Posição deste passo nesta visita (0 = o primeiro). */
  papirus: number
  /** Passo de uma janela por cima: voltar a fecha. */
  layer?: boolean
}

let started = false
/** Onde o histórico está agora. */
let depth = 0
/** Onde vai estar quando as voltas que nós mesmos pedimos terminarem. */
let logical = 0
/** O estado do passo atual. */
let current: BackState = { papirus: 0, u: null }
/** O lugar que o app está mostrando (pode estar debaixo de uma janela). */
let place: Place = { u: null }
/** Janelas abertas, pela posição do passo de cada uma. */
const layers = new Map<number, () => void>()
/** Passos conhecidos desta visita (para a seta "voltar" do próprio app). */
const known = new Map<number, BackState>()
/** Voltas pedidas por nós (fechar janela pelo X) que ainda não chegaram. */
let skipping = 0
/** Voltas automáticas por cima de passos de janelas que já fecharam. */
let passing = 0
let scheduled = false
/** O que espera essas voltas terminarem (abrir tela ou janela logo depois de fechar outra). */
const queue: (() => void)[] = []
const listeners = new Set<(p: Place) => void>()

const isBackState = (s: unknown): s is BackState => !!s && typeof s === 'object' && typeof (s as BackState).papirus === 'number'
const samePlace = (a: Place, b: Place) => a.u === b.u && (a.view ?? null) === (b.view ?? null) && (a.id ?? null) === (b.id ?? null)
const placeOf = (s: Place): Place => ({ u: s.u ?? null, view: s.view, id: s.id ?? null })
const busy = () => skipping > 0 || passing > 0 || scheduled
/** O app está saindo da página (sair da conta, recarregar): o histórico fica parado. */
let leaving = false

function write(state: BackState, push: boolean) {
  current = state
  known.set(state.papirus, state)
  try {
    if (push) history.pushState(state, '')
    else history.replaceState(state, '')
  } catch {
    // Dentro de uma moldura que não deixa mexer no histórico: o app segue, só sem o "voltar".
    leaving = true
  }
}

/** Começa a acompanhar o histórico. Pode ser chamado mais de uma vez. */
export function startBackStack() {
  if (started || typeof window === 'undefined') return
  started = true
  const st: unknown = history.state
  if (isBackState(st)) {
    // Recarregou (ou o Android reabriu o app): continua de onde estava, sem janelas.
    depth = logical = st.papirus
    place = placeOf(st)
    write({ ...place, papirus: depth }, false)
  } else {
    write({ ...(st && typeof st === 'object' ? st : {}), u: null, papirus: 0 }, false)
  }
  addEventListener('popstate', onPop)
}

/** Onde a pessoa estava (para reabrir no mesmo lugar). */
export function backState(): Place {
  startBackStack()
  return place
}

/** Avisa quando o "voltar" (ou "avançar") leva a outro lugar. */
export function onBackNavigate(fn: (p: Place) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function run(fn: () => void) {
  if (leaving) return
  if (busy()) queue.push(fn)
  else fn()
}

function flush() {
  while (queue.length && !busy()) queue.shift()!()
}

function onPop(e: PopStateEvent) {
  const st: BackState = isBackState(e.state) ? e.state : { ...place, papirus: 0 }
  depth = logical = st.papirus
  current = st
  known.set(depth, st)
  if (skipping > 0) {
    // Volta pedida por nós: o app já mostra o lugar certo; o passo passa a dizer isso.
    skipping--
    if (!samePlace(st, place) || st.layer !== (layers.has(depth) || undefined)) write({ ...place, papirus: depth, ...(layers.has(depth) ? { layer: true } : {}) }, false)
    flush()
    return
  }
  if (passing > 0) passing--
  // Voltar: fecha as janelas que estavam por cima, da mais alta para a mais baixa.
  for (const d of [...layers.keys()].sort((a, b) => b - a)) {
    if (d <= depth) continue
    const close = layers.get(d)!
    layers.delete(d)
    close()
  }
  // Passo de uma janela que já fechou (ou de antes de recarregar): segue voltando.
  if (st.layer && !layers.has(depth) && depth > 0) {
    passing++
    history.back()
    return
  }
  if (!samePlace(st, place)) {
    place = placeOf(st)
    for (const l of listeners) l(place)
  }
  flush()
}

/** Muda de lugar (tela, ficha, universo). `replace` troca o passo atual em vez de criar outro. */
export function navigateTo(next: Place, replace = false) {
  startBackStack()
  run(() => {
    // "Abrir este universo" quando ele já é o lugar atual mantém a tela e o registro (ao reabrir o app).
    if (samePlace(next, place) || (next.view === undefined && next.u !== null && next.u === place.u)) return
    place = placeOf(next)
    // Com uma janela por cima, trocar o lugar não pode apagar o passo da janela.
    if (replace) write({ ...place, papirus: depth, ...(current.layer ? { layer: true } : {}) }, false)
    else {
      depth = logical = depth + 1
      write({ ...place, papirus: depth }, true)
    }
  })
}

/**
 * A seta "voltar" do próprio app (a da ficha, por exemplo): se o passo anterior é o lugar
 * pedido, volta de verdade (o histórico não cresce à toa); senão, troca o passo atual.
 */
export function backTo(target: Place, apply: () => void) {
  startBackStack()
  const prev = known.get(depth - 1)
  if (prev && !prev.layer && !current.layer && samePlace(prev, target) && !busy()) {
    history.back()
    return
  }
  navigateTo(target, true)
  apply()
}

/**
 * Abre um passo para uma janela: voltar chama `close`. Devolve a função para avisar que a
 * janela fechou por outro caminho (X, Esc, tocar fora): o passo some do histórico.
 */
export function openLayer(close: () => void): () => void {
  startBackStack()
  let mine = -1
  let gone = false
  run(() => {
    if (gone) return
    depth = logical = depth + 1
    mine = depth
    layers.set(mine, close)
    write({ ...place, papirus: depth, layer: true }, true)
  })
  return () => {
    gone = true
    if (leaving || mine < 0 || !layers.has(mine)) return
    layers.delete(mine)
    if (mine !== logical) return
    // Era a de cima: tira o passo (e os de janelas que já tinham fechado logo abaixo).
    logical--
    while (logical > 0 && known.get(logical)?.layer && !layers.has(logical)) logical--
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      const n = depth - logical
      if (n > 0) {
        skipping++
        history.go(-n)
      } else flush()
    })
  }
}

/**
 * Sai da página (para a apresentação, ou recarrega). As janelas que fecham junto não mexem
 * no histórico: um "voltar" pedido agora cancelaria a saída.
 */
export function leavePage(url?: string) {
  leaving = true
  queue.length = 0
  if (url === undefined) location.reload()
  else location.assign(url)
}
