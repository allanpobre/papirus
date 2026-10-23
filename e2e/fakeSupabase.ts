import type { BrowserContext, Route } from '@playwright/test'

/**
 * Um Supabase de mentira, compartilhado entre vários navegadores (contextos), com as
 * regras de supabase/contas.sql e supabase/compartilhar.sql: cada um vê o que é seu,
 * quem pode editar altera o universo do dono, quem só vê lê a cópia de leitura.
 */
export const SERVER = 'https://papirus-teste.supabase.co'

type Row = Record<string, unknown>
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

export const PEOPLE = {
  ana: { id: '11111111-1111-4111-8111-111111111111', email: 'ana@exemplo.com' },
  bia: { id: '22222222-2222-4222-8222-222222222222', email: 'bia@exemplo.com' },
  caio: { id: '33333333-3333-4333-8333-333333333333', email: 'caio@exemplo.com' },
}
export const PASSWORD = 'segredo123'

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = { papirus_universes: [], papirus_shares: [], papirus_members: [] }
  const userOf = (route: Route) => {
    const auth = route.request().headers()['authorization'] ?? ''
    try {
      const sub = JSON.parse(Buffer.from(auth.replace('Bearer ', '').split('.')[1] ?? '', 'base64url').toString()).sub as string
      return Object.values(PEOPLE).find((p) => p.id === sub) ?? null
    } catch {
      return null
    }
  }
  const roleOf = (me: { email: string } | null, owner: unknown, universe: unknown) =>
    (me && (tables.papirus_members.find((m) => m.owner_id === owner && m.universe_id === universe && m.email === me.email)?.role as string)) || null

  /** O RLS: o que cada pessoa enxerga em cada tabela. */
  const visible = (table: string, me: (typeof PEOPLE)['ana'] | null, r: Row, write = false) => {
    if (!me) return false
    if (table === 'papirus_universes') return r.user_id === me.id || roleOf(me, r.user_id, r.id) === 'editar'
    if (table === 'papirus_shares') return r.owner_id === me.id || (!write && roleOf(me, r.owner_id, r.universe_id) !== null)
    return r.owner_id === me.id || r.email === me.email
  }

  const matches = (params: URLSearchParams, r: Row) => {
    for (const [k, v] of params) {
      if (['select', 'on_conflict', 'columns', 'order', 'limit'].includes(k)) continue
      if (v.startsWith('eq.')) {
        const want = v.slice(3)
        const have = r[k]
        if (k === 'updated_at' ? Date.parse(String(have)) !== Date.parse(want) : String(have) !== want) return false
      } else if (v.startsWith('in.(')) {
        if (!v.slice(4, -1).split(',').includes(String(r[k]))) return false
      }
    }
    return true
  }
  const pick = (r: Row, select: string | null) => (!select || select === '*' ? r : Object.fromEntries(select.split(',').map((c) => [c, r[c]])))

  async function attach(context: BrowserContext) {
    await context.route(`${SERVER}/auth/v1/**`, async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (url.includes('/token')) {
        const body = route.request().postDataJSON() as { email?: string; password?: string }
        const person = Object.values(PEOPLE).find((p) => p.email === body.email)
        if (!person || body.password !== PASSWORD) return route.fulfill({ status: 400, headers: cors, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' } })
        const user = { ...person, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
        return route.fulfill({ headers: cors, json: { access_token: jwt(person.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user } })
      }
      if (url.includes('/logout')) return route.fulfill({ status: 204, headers: cors, body: '' })
      if (url.includes('/user')) {
        const me = userOf(route)
        return me ? route.fulfill({ headers: cors, json: { ...me, aud: 'authenticated', role: 'authenticated' } }) : route.fulfill({ status: 401, headers: cors, json: {} })
      }
      return route.fulfill({ status: 404, headers: cors, json: {} })
    })

    await context.route(`${SERVER}/rest/v1/**`, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const url = new URL(req.url())
      const me = userOf(route)
      const path = url.pathname.replace('/rest/v1/', '')

      if (path === 'rpc/papirus_link_get') {
        const { token } = req.postDataJSON() as { token: string }
        const s = tables.papirus_shares.find((x) => x.link_token && x.link_token === token)
        return route.fulfill({ headers: cors, json: s ? [{ universe_id: s.universe_id, name: s.name, owner_email: s.owner_email, data: s.data, updated_at: s.updated_at }] : [] })
      }
      if (path === 'rpc/papirus_share_data') {
        const { o, u, d, n } = req.postDataJSON() as { o: string; u: string; d: unknown; n: string }
        if (!me || !(o === me.id || roleOf(me, o, u) === 'editar')) return route.fulfill({ status: 400, headers: cors, json: { message: 'sem permissão' } })
        const s = tables.papirus_shares.find((x) => x.owner_id === o && x.universe_id === u)
        if (s) Object.assign(s, { data: d, name: n, updated_at: new Date().toISOString() })
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }

      const table = tables[path]
      if (!table || !me) return route.fulfill({ status: 401, headers: cors, json: { message: 'permission denied' } })
      const select = url.searchParams.get('select')
      const prefer = req.headers()['prefer'] ?? ''
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      const reply = (rows: Row[], status = 200) => {
        const out = rows.map((r) => pick(r, select))
        if (single) return out.length ? route.fulfill({ status, headers: cors, json: out[0] }) : route.fulfill({ status: 406, headers: cors, json: { code: 'PGRST116', message: 'no rows' } })
        return route.fulfill({ status, headers: cors, json: out })
      }

      if (req.method() === 'GET') return reply(table.filter((r) => visible(path, me, r) && matches(url.searchParams, r)))

      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Row | Row[]
        const keys: Record<string, string[]> = { papirus_universes: ['user_id', 'id'], papirus_shares: ['owner_id', 'universe_id'], papirus_members: ['owner_id', 'universe_id', 'email'] }
        for (const raw of Array.isArray(body) ? body : [body]) {
          const r: Row = { ...raw }
          if (path === 'papirus_universes') r.user_id ??= me.id
          else r.owner_id ??= me.id
          if (path === 'papirus_members') r.created_at ??= new Date().toISOString()
          if (path === 'papirus_shares') Object.assign(r, { show_secrets: r.show_secrets ?? false, link_token: r.link_token ?? null, updated_at: new Date().toISOString() })
          if ((path === 'papirus_universes' ? r.user_id : r.owner_id) !== me.id) return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
          const existing = table.find((x) => keys[path].every((k) => x[k] === r[k]))
          if (existing) {
            if (prefer.includes('ignore-duplicates')) continue
            if (prefer.includes('merge-duplicates')) Object.assign(existing, r)
            else return route.fulfill({ status: 409, headers: cors, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
          } else table.push(r)
        }
        return route.fulfill({ status: 201, headers: cors, body: '' })
      }

      if (req.method() === 'PATCH') {
        const changes = req.postDataJSON() as Row
        const hit = table.filter((r) => visible(path, me, r, true) && matches(url.searchParams, r))
        if (path === 'papirus_members') {
          // Só o dono muda papéis.
          for (const r of hit) if (r.owner_id === me.id) Object.assign(r, changes)
        } else for (const r of hit) Object.assign(r, changes)
        return prefer.includes('return=representation') ? reply(hit) : route.fulfill({ status: 204, headers: cors, body: '' })
      }

      if (req.method() === 'DELETE') {
        const hit = table.filter((r) => matches(url.searchParams, r) && (path === 'papirus_universes' ? r.user_id === me.id : visible(path, me, r, true)))
        tables[path] = table.filter((r) => !hit.includes(r))
        if (path === 'papirus_shares') tables.papirus_members = tables.papirus_members.filter((m) => !hit.some((s) => s.owner_id === m.owner_id && s.universe_id === m.universe_id))
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }
      return route.fulfill({ status: 405, headers: cors, body: '' })
    })
  }

  return { tables, attach }
}
