import type { BrowserContext, WebSocketRoute } from '@playwright/test'

/**
 * O tempo real do Supabase, de mentira: aceita a entrada nos canais e repassa cada broadcast
 * às outras páginas no mesmo canal (como o servidor de verdade, sem devolver a quem mandou).
 * Fala o protocolo 2.0.0 do realtime-js: mensagens JSON em lista e broadcasts em binário.
 */
export async function fakeRealtime(context: BrowserContext, server: string) {
  const sockets = new Set<{ ws: WebSocketRoute; topics: Set<string> }>()
  const broadcasts: { topic: string; event: string; payload: unknown }[] = []

  const relay = (from: WebSocketRoute, topic: string, event: string, payload: unknown) => {
    broadcasts.push({ topic, event, payload })
    const t = Buffer.from(topic)
    const e = Buffer.from(event)
    const body = Buffer.from(JSON.stringify(payload))
    // Tipo 4 (broadcast para quem está no canal): tamanhos do tópico, do evento e dos metadados, e a codificação (1 = JSON).
    const frame = Buffer.concat([Buffer.from([4, t.length, e.length, 0, 1]), t, e, body])
    for (const s of sockets) if (s.ws !== from && s.topics.has(topic)) s.ws.send(frame)
  }

  await context.routeWebSocket(new RegExp(`^${server.replace(/^https/, 'wss').replace(/\./g, '\\.')}/realtime/`), (ws) => {
    const me = { ws, topics: new Set<string>() }
    sockets.add(me)
    ws.onClose(() => sockets.delete(me))
    ws.onMessage((message) => {
      if (typeof message === 'string') {
        const [joinRef, ref, topic, event, payload] = JSON.parse(message) as [string | null, string | null, string, string, Record<string, unknown>]
        const reply = (response: object = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))
        if (event === 'phx_join') {
          me.topics.add(topic)
          reply({ postgres_changes: [] })
        } else if (event === 'phx_leave') {
          me.topics.delete(topic)
          reply()
        } else if (event === 'broadcast') {
          relay(ws, topic, String(payload.event), payload.payload)
          reply()
        } else reply()
        return
      }
      // Tipo 3 (broadcast enviado por um cliente): tamanhos de join_ref, ref, tópico, evento e metadados, e a codificação.
      const b = Buffer.from(message)
      if (b[0] !== 3) return
      const [joinLen, refLen, topicLen, eventLen, metaLen, encoding] = [b[1], b[2], b[3], b[4], b[5], b[6]]
      let at = 7 + joinLen + refLen
      const topic = b.subarray(at, (at += topicLen)).toString()
      const event = b.subarray(at, (at += eventLen)).toString()
      at += metaLen
      const raw = b.subarray(at)
      relay(ws, topic, event, encoding === 1 ? JSON.parse(raw.toString()) : raw)
    })
  })
  return { broadcasts }
}
