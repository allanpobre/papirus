import { describe, expect, it } from 'vitest'
import { mainScriptOf, precacheUrls } from './pwa'

describe('versão nova', () => {
  it('acha o script principal da página, do jeito que o build escreve', () => {
    const html = '<head><script type="module" crossorigin src="/assets/app-Cqb8dOUr.js"></script></head>'
    expect(mainScriptOf(html, 'https://exemplo.com/app/')).toBe('/assets/app-Cqb8dOUr.js')
    // Com caminho relativo (app publicado numa subpasta).
    expect(mainScriptOf('<script src="../assets/app-Z9.js" type="module"></script>', 'https://exemplo.com/papirus/app/')).toBe('/papirus/assets/app-Z9.js')
    expect(mainScriptOf('<p>sem script</p>', 'https://exemplo.com/app/')).toBeNull()
  })
})

describe('abrir sem internet', () => {
  it('monta os endereços da lista de arquivos do build', () => {
    expect(precacheUrls(['assets/app-1.js', 'assets/fonte.woff2'], '/')).toEqual(['/assets/app-1.js', '/assets/fonte.woff2'])
    // Numa subpasta do site.
    expect(precacheUrls(['assets/app-1.js'], '/papirus/')).toEqual(['/papirus/assets/app-1.js'])
  })
  it('ignora o que não é nome de arquivo do site', () => {
    expect(precacheUrls(['../fora.js', 'https://outro.com/x.js', 42, 'a b.js'], '/')).toEqual([])
    expect(precacheUrls(undefined, '/')).toEqual([])
    expect(precacheUrls({ files: 1 }, '/')).toEqual([])
  })
})
