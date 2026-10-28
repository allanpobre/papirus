import type { BrowserContext, Route } from '@playwright/test'

/**
 * Um Supabase de mentira, compartilhado entre vários navegadores (contextos), com as
 * regras de supabase/contas.sql e supabase/compartilhar.sql: cada um vê o que é seu,
 * quem pode editar altera o universo do dono, quem só vê lê a cópia de leitura.
 * Também supabase/social.sql: perfis, amizades e a estante (privado/amigos/público).
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
  const tables: Record<string, Row[]> = { papirus_universes: [], papirus_shares: [], papirus_members: [], papirus_profiles: [], papirus_friendships: [], papirus_shelf: [], papirus_shelf_reactions: [], papirus_shelf_comments: [], papirus_challenges: [], papirus_challenge_members: [], papirus_challenge_days: [], papirus_feedback: [], papirus_shelf_text: [], papirus_chapter_reactions: [], papirus_activity: [] }
  const images = new Map<string, { owner: string; body: Buffer; type: string; at: string }>()
  const QUOTA = 100 * 1024 * 1024
  const usage = (owner: string) => [...images.values()].filter((v) => v.owner === owner).reduce((n, v) => n + v.body.length, 0)
  const friends = (a: unknown, b: unknown) =>
    tables.papirus_friendships.some((f) => f.status === 'aceita' && ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)))
  /** Tabelas que quem não tem conta também lê (o que é público). */
  const PUBLIC_READ = new Set(['papirus_profiles', 'papirus_shelf', 'papirus_shelf_reactions', 'papirus_shelf_comments', 'papirus_shelf_text', 'papirus_chapter_reactions'])
  /** Coluna do dono de cada linha (quem pode escrever). */
  const OWNER: Record<string, string> = { papirus_universes: 'user_id', papirus_profiles: 'user_id', papirus_friendships: 'requester', papirus_shelf: 'owner', papirus_shelf_reactions: 'user_id', papirus_shelf_comments: 'author', papirus_challenges: 'owner', papirus_challenge_members: 'user_id', papirus_challenge_days: 'user_id', papirus_shelf_text: 'owner', papirus_chapter_reactions: 'user_id', papirus_activity: 'actor' }
  // Contas: as de sempre e as criadas no teste (com o que foi preenchido ao criar).
  const accounts: { id: string; email: string; password: string; meta: Record<string, unknown> }[] = Object.values(PEOPLE).map((p) => ({ ...p, password: PASSWORD, meta: {} }))
  const session = (a: (typeof accounts)[number]) => {
    const user = { id: a.id, email: a.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: a.meta, created_at: new Date().toISOString() }
    return { access_token: jwt(a.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user }
  }
  const userOf = (route: Route) => {
    const auth = route.request().headers()['authorization'] ?? ''
    try {
      const sub = JSON.parse(Buffer.from(auth.replace('Bearer ', '').split('.')[1] ?? '', 'base64url').toString()).sub as string
      const a = accounts.find((p) => p.id === sub)
      return a ? { id: a.id, email: a.email } : null
    } catch {
      return null
    }
  }
  const roleOf = (me: { email: string } | null, owner: unknown, universe: unknown) =>
    (me && (tables.papirus_members.find((m) => m.owner_id === owner && m.universe_id === universe && m.email === me.email)?.role as string)) || null

  /** O RLS: o que cada pessoa enxerga em cada tabela. */
  const bookVisible = (me: { id: string } | null, owner: unknown, bookId: unknown) => {
    const b = tables.papirus_shelf.find((x) => x.owner === owner && x.id === bookId)
    return !!b && (b.owner === me?.id || b.visibility === 'publico' || (!!me && b.visibility === 'amigos' && friends(b.owner, me.id)))
  }
  const inChallenge = (c: unknown, u: unknown) => tables.papirus_challenge_members.some((m) => m.challenge_id === c && m.user_id === u)
  const challengeVisible = (me: { id: string } | null, id: unknown) => {
    const c = tables.papirus_challenges.find((x) => x.id === id)
    return !!c && !!me && (c.owner === me.id || friends(c.owner, me.id) || inChallenge(c.id, me.id))
  }
  const visible = (table: string, me: (typeof PEOPLE)['ana'] | null, r: Row, write = false) => {
    if (table === 'papirus_challenges') return write ? r.owner === me?.id : challengeVisible(me, r.id)
    if (table === 'papirus_challenge_members') return write ? r.user_id === me?.id : challengeVisible(me, r.challenge_id)
    if (table === 'papirus_challenge_days') return write ? r.user_id === me?.id : !!me && inChallenge(r.challenge_id, me.id)
    if (table === 'papirus_shelf_text') return write ? r.owner === me?.id : bookVisible(me, r.owner, r.book_id)
    if (table === 'papirus_chapter_reactions') return write ? r.user_id === me?.id : bookVisible(me, r.owner, r.book_id)
    if (table === 'papirus_activity') return !!me && (r.actor === me.id || (!write && friends(r.actor, me.id)))
    if (table === 'papirus_shelf_reactions' || table === 'papirus_shelf_comments') {
      if (write) return table === 'papirus_shelf_reactions' ? r.user_id === me?.id : r.author === me?.id || r.owner === me?.id
      return bookVisible(me, r.owner, r.book_id)
    }
    if (table === 'papirus_shelf') return write ? r.owner === me?.id : r.owner === me?.id || r.visibility === 'publico' || (!!me && r.visibility === 'amigos' && friends(r.owner, me.id))
    if (table === 'papirus_profiles')
      return write ? r.user_id === me?.id : !!me || tables.papirus_shelf.some((x) => x.owner === r.user_id && x.visibility === 'publico')
    if (!me) return false
    if (table === 'papirus_friendships') return r.requester === me.id || r.addressee === me.id
    if (table === 'papirus_universes') return r.user_id === me.id || roleOf(me, r.user_id, r.id) === 'editar'
    if (table === 'papirus_shares') return r.owner_id === me.id || (!write && roleOf(me, r.owner_id, r.universe_id) !== null)
    return r.owner_id === me.id || r.email === me.email
  }

  const matches = (params: URLSearchParams, r: Row) => {
    for (const [k, v] of params) {
      if (['select', 'on_conflict', 'columns', 'order', 'limit'].includes(k)) continue
      if (k === 'or') {
        // or=(a.eq.1,b.eq.2)
        const any = v
          .slice(1, -1)
          .split(',')
          .some((cond) => {
            const [col, op, ...rest] = cond.split('.')
            return op === 'eq' && String(r[col]) === rest.join('.')
          })
        if (!any) return false
        continue
      }
      if (v.startsWith('eq.')) {
        const want = v.slice(3)
        const have = r[k]
        if (k === 'updated_at' ? Date.parse(String(have)) !== Date.parse(want) : String(have) !== want) return false
      } else if (v.startsWith('neq.')) {
        if (String(r[k]) === v.slice(4)) return false
      } else if (v.startsWith('gte.')) {
        if (!(String(r[k]) >= v.slice(4))) return false
      } else if (v.startsWith('in.(')) {
        if (!v.slice(4, -1).split(',').includes(String(r[k]))) return false
      }
    }
    return true
  }
  const pick = (r: Row, select: string | null) => (!select || select === '*' ? r : Object.fromEntries(select.split(',').map((c) => [c, r[c]])))

  async function attach(context: BrowserContext) {
    // Storage: a pasta pública de imagens (supabase/imagens.sql), com o limite por conta.
    await context.route(`${SERVER}/storage/v1/**`, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const url = new URL(req.url())
      const me = userOf(route)
      const path = url.pathname.replace('/storage/v1/', '')
      const pub = path.match(/^object\/public\/papirus-imagens\/([0-9a-f]{32})$/)
      if (pub && req.method() === 'GET') {
        const img = images.get(pub[1])
        return img ? route.fulfill({ status: 200, headers: { ...cors, 'content-type': img.type }, body: img.body }) : route.fulfill({ status: 400, headers: cors, json: { statusCode: '404', error: 'not_found', message: 'Object not found' } })
      }
      if (!me) return route.fulfill({ status: 400, headers: cors, json: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } })
      const up = path.match(/^object\/papirus-imagens\/(.+)$/)
      if (up && req.method() === 'POST') {
        const id = up[1]
        if (!/^[0-9a-f]{32}$/.test(id) || usage(me.id) >= QUOTA) return route.fulfill({ status: 400, headers: cors, json: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } })
        if (images.has(id)) return route.fulfill({ status: 400, headers: cors, json: { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' } })
        const body = req.postDataBuffer() ?? Buffer.alloc(0)
        images.set(id, { owner: me.id, body, type: req.headers()['content-type'] ?? 'image/webp', at: new Date().toISOString() })
        return route.fulfill({ headers: cors, json: { Key: `papirus-imagens/${id}`, Id: id } })
      }
      if (path === 'object/list/papirus-imagens' && req.method() === 'POST') {
        const mine = [...images].filter(([, v]) => v.owner === me.id)
        return route.fulfill({ headers: cors, json: mine.map(([id, v]) => ({ name: id, id, created_at: v.at, metadata: { size: v.body.length, mimetype: v.type } })) })
      }
      if (path === 'object/papirus-imagens' && req.method() === 'DELETE') {
        const { prefixes } = req.postDataJSON() as { prefixes: string[] }
        const gone = prefixes.filter((id) => images.get(id)?.owner === me.id)
        for (const id of gone) images.delete(id)
        return route.fulfill({ headers: cors, json: gone.map((name) => ({ name })) })
      }
      return route.fulfill({ status: 400, headers: cors, json: { statusCode: '404', error: 'not_found', message: 'not found' } })
    })

    await context.route(`${SERVER}/auth/v1/**`, async (route) => {
      const url = route.request().url()
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (url.includes('/signup')) {
        const body = route.request().postDataJSON() as { email: string; password: string; data?: Record<string, unknown> }
        if (accounts.some((a) => a.email === body.email)) return route.fulfill({ status: 422, headers: cors, json: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } })
        const a = { id: crypto.randomUUID(), email: body.email, password: body.password, meta: body.data ?? {} }
        accounts.push(a)
        return route.fulfill({ headers: cors, json: session(a) })
      }
      if (url.includes('/token')) {
        const body = route.request().postDataJSON() as { email?: string; password?: string }
        const person = accounts.find((p) => p.email === body.email)
        if (!person || body.password !== person.password) return route.fulfill({ status: 400, headers: cors, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' } })
        return route.fulfill({ headers: cors, json: session(person) })
      }
      if (url.includes('/logout')) return route.fulfill({ status: 204, headers: cors, body: '' })
      if (url.includes('/user')) {
        const me = userOf(route)
        return me ? route.fulfill({ headers: cors, json: session(accounts.find((a) => a.id === me.id)!).user }) : route.fulfill({ status: 401, headers: cors, json: {} })
      }
      return route.fulfill({ status: 404, headers: cors, json: {} })
    })

    await context.route(`${SERVER}/rest/v1/**`, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const url = new URL(req.url())
      const me = userOf(route)
      const path = url.pathname.replace('/rest/v1/', '')

      if (path === 'rpc/papirus_image_usage') {
        if (!me) return route.fulfill({ status: 401, headers: cors, json: { message: 'permission denied for function papirus_image_usage' } })
        return route.fulfill({ headers: cors, json: usage(me.id) })
      }
      if (path === 'rpc/papirus_link_get') {
        const { token } = req.postDataJSON() as { token: string }
        const s = tables.papirus_shares.find((x) => x.link_token && x.link_token === token)
        return route.fulfill({ headers: cors, json: s ? [{ universe_id: s.universe_id, name: s.name, owner_email: s.owner_email, data: s.data, updated_at: s.updated_at }] : [] })
      }
      if (path === 'rpc/papirus_feedback_add') {
        const { token, o, u, scene, q, b, n } = req.postDataJSON() as Record<string, string | null>
        const s = token ? tables.papirus_shares.find((x) => x.link_token && x.link_token === token) : tables.papirus_shares.find((x) => x.owner_id === o && x.universe_id === u && roleOf(me, o, u))
        if (!s) return route.fulfill({ status: 400, headers: cors, json: { message: 'sem permissão para comentar' } })
        if (!b?.trim()) return route.fulfill({ status: 400, headers: cors, json: { message: 'comentário vazio' } })
        tables.papirus_feedback.push({ id: crypto.randomUUID(), owner_id: s.owner_id, universe_id: s.universe_id, scene_id: scene, quote: q ?? '', body: b, author_name: n ?? '', resolved: false, created_at: new Date().toISOString() })
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }
      if (path === 'rpc/papirus_feedback_from_shelf') {
        const { o, book, scene, q, b } = req.postDataJSON() as Record<string, string>
        if (!me || !bookVisible(me, o, book)) return route.fulfill({ status: 400, headers: cors, json: { message: 'sem permissão para comentar' } })
        const p = tables.papirus_profiles.find((x) => x.user_id === me.id)
        tables.papirus_feedback.push({ id: crypto.randomUUID(), owner_id: o, universe_id: book.split(':')[0], scene_id: scene, quote: q ?? '', body: b, author_name: p ? p.name || `@${p.handle}` : '', resolved: false, via: 'estante', created_at: new Date().toISOString() })
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }
      if (path === 'rpc/papirus_share_data') {
        const { o, u, d, n } = req.postDataJSON() as { o: string; u: string; d: unknown; n: string }
        if (!me || !(o === me.id || roleOf(me, o, u) === 'editar')) return route.fulfill({ status: 400, headers: cors, json: { message: 'sem permissão' } })
        const s = tables.papirus_shares.find((x) => x.owner_id === o && x.universe_id === u)
        if (s) Object.assign(s, { data: d, name: n, updated_at: new Date().toISOString() })
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }

      const table = tables[path]
      if (table && !me && req.method() === 'GET' && PUBLIC_READ.has(path)) {
        const select = url.searchParams.get('select')
        return route.fulfill({ headers: cors, json: table.filter((r) => visible(path, null, r) && matches(url.searchParams, r)).map((r) => pick(r, select)) })
      }
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
        const keys: Record<string, string[]> = {
          papirus_universes: ['user_id', 'id'],
          papirus_shares: ['owner_id', 'universe_id'],
          papirus_members: ['owner_id', 'universe_id', 'email'],
          papirus_profiles: ['user_id'],
          papirus_friendships: ['requester', 'addressee'],
          papirus_shelf: ['owner', 'id'],
          papirus_shelf_reactions: ['owner', 'book_id', 'user_id'],
          papirus_shelf_comments: ['id'],
          papirus_challenges: ['id'],
          papirus_challenge_members: ['challenge_id', 'user_id'],
          papirus_challenge_days: ['challenge_id', 'user_id', 'day'],
          papirus_shelf_text: ['owner', 'book_id'],
          papirus_chapter_reactions: ['owner', 'book_id', 'scene_id', 'user_id'],
          papirus_activity: ['id'],
        }
        const written: Row[] = []
        for (const raw of Array.isArray(body) ? body : [body]) {
          const r: Row = { ...raw }
          const ownerCol = OWNER[path] ?? 'owner_id'
          r[ownerCol] ??= me.id
          if (path === 'papirus_profiles') {
            if (!/^[a-z0-9_.]{3,24}$/.test(String(r.handle))) return route.fulfill({ status: 400, headers: cors, json: { code: '23514', message: 'violates check constraint "papirus_profiles_handle_check"' } })
            if (table.some((x) => x.handle === r.handle && x.user_id !== r.user_id))
              return route.fulfill({ status: 409, headers: cors, json: { code: '23505', message: 'duplicate key value violates unique constraint "papirus_profiles_handle_key"' } })
            Object.assign(r, { name: r.name ?? '', bio: r.bio ?? '', avatar: r.avatar ?? null })
          }
          if (path === 'papirus_shelf_reactions' || path === 'papirus_shelf_comments') {
            if (!bookVisible(me, r.owner, r.book_id)) return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
            if (path === 'papirus_shelf_comments') r.id ??= crypto.randomUUID()
            r.created_at ??= new Date().toISOString()
          }
          if (path === 'papirus_challenges') Object.assign(r, { id: r.id ?? crypto.randomUUID(), created_at: new Date().toISOString() })
          if (path === 'papirus_activity') Object.assign(r, { id: crypto.randomUUID(), created_at: new Date().toISOString(), book_id: r.book_id ?? null, title: r.title ?? '', n: r.n ?? 0 })
          if ((path === 'papirus_shelf_text' || path === 'papirus_chapter_reactions') && !tables.papirus_shelf.some((b) => b.owner === r.owner && b.id === r.book_id))
            return route.fulfill({ status: 409, headers: cors, json: { code: '23503', message: 'violates foreign key constraint' } })
          if (path === 'papirus_chapter_reactions' && !bookVisible(me, r.owner, r.book_id))
            return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
          if (path === 'papirus_challenge_members' && !challengeVisible(me, r.challenge_id))
            return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
          if (path === 'papirus_challenge_days' && !inChallenge(r.challenge_id, me.id))
            return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
          if (path === 'papirus_shelf' && !table.some((x) => x.owner === r.owner && x.id === r.id)) r.created_at ??= new Date().toISOString()
          if (path === 'papirus_friendships') {
            if (r.status !== 'pendente' || r.requester === r.addressee) return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
            if (table.some((x) => x.requester === r.addressee && x.addressee === r.requester))
              return route.fulfill({ status: 409, headers: cors, json: { code: '23505', message: 'duplicate key value violates unique constraint "papirus_friendships_pair"' } })
            r.created_at ??= new Date().toISOString()
          }
          if (path === 'papirus_members') r.created_at ??= new Date().toISOString()
          if (path === 'papirus_shares') Object.assign(r, { show_secrets: r.show_secrets ?? false, link_token: r.link_token ?? null, updated_at: new Date().toISOString() })
          if (r[ownerCol] !== me.id) return route.fulfill({ status: 403, headers: cors, json: { message: 'new row violates row-level security policy' } })
          const existing = table.find((x) => keys[path].every((k) => x[k] === r[k]))
          if (existing) {
            if (prefer.includes('ignore-duplicates')) continue
            if (prefer.includes('merge-duplicates')) Object.assign(existing, r)
            else return route.fulfill({ status: 409, headers: cors, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
            written.push(existing)
          } else {
            table.push(r)
            written.push(r)
          }
        }
        return prefer.includes('return=representation') ? reply(written, 201) : route.fulfill({ status: 201, headers: cors, body: '' })
      }

      if (req.method() === 'PATCH') {
        const changes = req.postDataJSON() as Row
        const hit = table.filter((r) => visible(path, me, r, true) && matches(url.searchParams, r))
        if (path === 'papirus_members') {
          // Só o dono muda papéis.
          for (const r of hit) if (r.owner_id === me.id) Object.assign(r, changes)
        } else if (path === 'papirus_friendships') {
          // Só quem recebeu aceita, e só o status muda.
          for (const r of hit) if (r.addressee === me.id) r.status = changes.status
        } else for (const r of hit) Object.assign(r, changes)
        return prefer.includes('return=representation') ? reply(hit) : route.fulfill({ status: 204, headers: cors, body: '' })
      }

      if (req.method() === 'DELETE') {
        const hit = table.filter((r) => matches(url.searchParams, r) && (path === 'papirus_universes' ? r.user_id === me.id : visible(path, me, r, true)))
        tables[path] = table.filter((r) => !hit.includes(r))
        if (path === 'papirus_challenges') {
          tables.papirus_challenge_members = tables.papirus_challenge_members.filter((m) => !hit.some((c) => c.id === m.challenge_id))
          tables.papirus_challenge_days = tables.papirus_challenge_days.filter((d) => !hit.some((c) => c.id === d.challenge_id))
        }
        if (path === 'papirus_challenge_members')
          tables.papirus_challenge_days = tables.papirus_challenge_days.filter((d) => !hit.some((m) => m.challenge_id === d.challenge_id && m.user_id === d.user_id))
        if (path === 'papirus_shelf')
          for (const t of ['papirus_shelf_reactions', 'papirus_shelf_comments', 'papirus_shelf_text', 'papirus_chapter_reactions']) tables[t] = tables[t].filter((x) => !hit.some((b) => b.owner === x.owner && b.id === x.book_id))
        if (path === 'papirus_shares') tables.papirus_members = tables.papirus_members.filter((m) => !hit.some((s) => s.owner_id === m.owner_id && s.universe_id === m.universe_id))
        return route.fulfill({ status: 204, headers: cors, body: '' })
      }
      return route.fulfill({ status: 405, headers: cors, body: '' })
    })
  }

  return { tables, images, attach }
}
