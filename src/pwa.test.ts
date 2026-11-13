import { describe, expect, it } from 'vitest'
import { mainScriptOf } from './pwa'

describe('versão nova', () => {
  it('acha o script principal da página, do jeito que o build escreve', () => {
    const html = '<head><script type="module" crossorigin src="/assets/app-Cqb8dOUr.js"></script></head>'
    expect(mainScriptOf(html, 'https://exemplo.com/app/')).toBe('/assets/app-Cqb8dOUr.js')
    // Com caminho relativo (app publicado numa subpasta).
    expect(mainScriptOf('<script src="../assets/app-Z9.js" type="module"></script>', 'https://exemplo.com/papirus/app/')).toBe('/papirus/assets/app-Z9.js')
    expect(mainScriptOf('<p>sem script</p>', 'https://exemplo.com/app/')).toBeNull()
  })
})
