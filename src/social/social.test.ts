import { describe, expect, it } from 'vitest'
import { addBook, updateBook } from '../export/shelf'
import { sampleUniverse } from '../model/sample'
import { cleanHandle, isHandle, profileLink, shelfRowOf, suggestHandle } from './social'

describe('social', () => {
  it('limpa o @ como a pessoa digitou', () => {
    expect(cleanHandle('@Ana Ribeiro')).toBe('ana_ribeiro')
    expect(cleanHandle('  João.Á ')).toBe('joao.a')
    expect(isHandle('ab')).toBe(false)
    expect(isHandle('ana_ribeiro')).toBe(true)
    expect(suggestHandle('Lu@x.com')).toBe('lul')
  })

  it('livro privado não vai; os outros vão só com a vitrine', () => {
    let [u, b] = addBook(sampleUniverse(), { title: 'A Maré' })
    expect(shelfRowOf(u, b, null)).toBeNull()
    u = updateBook(u, b.id, { shelfVisibility: 'amigos', blurb: 'Sinopse.' })
    b = u.books.find((x) => x.id === b.id)!
    const row = shelfRowOf(u, b, 'https://exemplo/app/?ler=1')!
    expect(row).toMatchObject({ id: `${u.id}:${b.id}`, title: 'A Maré', blurb: 'Sinopse.', visibility: 'amigos', universe_name: u.name })
    expect(row.words).toBeGreaterThan(0)
    expect(JSON.stringify(row)).not.toContain(u.scenes[0].text.slice(0, 40))
  })

  it('link do perfil aponta para o app', () => {
    expect(profileLink('https://allanpobre.github.io/papirus/', 'ana')).toBe('https://allanpobre.github.io/papirus/app/?perfil=ana')
  })
})
