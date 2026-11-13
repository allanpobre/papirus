import { describe, expect, it } from 'vitest'
import { readAuthLink, withoutAuthLink } from './auth'

const APP = 'https://allanpobre.github.io/papirus/app/'

describe('volta dos links de e-mail', () => {
  it('lê as chaves e o tipo (trocar a senha)', () => {
    const link = readAuthLink(`${APP}#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery`)
    expect(link).toEqual({ tokens: { access_token: 'a.b.c', refresh_token: 'r1' }, type: 'recovery' })
  })

  it('explica o link vencido ou já usado (no # ou no ?)', () => {
    const hash = readAuthLink(`${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)
    expect(hash?.problem).toMatch(/venceu ou já foi usado/)
    const query = readAuthLink(`${APP}?error=server_error&error_description=Algo+deu+errado`)
    expect(query?.problem).toBe('O link do e-mail não funcionou (Algo deu errado). Peça outro.')
  })

  it('ignora endereços sem retorno de link (inclusive # da wiki e ?perfil)', () => {
    expect(readAuthLink(`${APP}?perfil=ana`)).toBeNull()
    expect(readAuthLink(`${APP}#capitulo-2`)).toBeNull()
  })

  it('limpa só o que é do link', () => {
    expect(withoutAuthLink(`${APP}?perfil=ana#access_token=x&refresh_token=y&type=magiclink`)).toBe('/papirus/app/?perfil=ana')
    expect(withoutAuthLink(`${APP}?error=x&error_description=y&mestrar`)).toBe('/papirus/app/?mestrar=')
    expect(withoutAuthLink(`${APP}#capitulo-2`)).toBe('/papirus/app/#capitulo-2')
  })
})
