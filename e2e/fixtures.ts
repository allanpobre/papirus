import { test as base } from '@playwright/test'

/** Testes que não são sobre o tour começam com ele já visto, para não ficar por cima da tela. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
        if (!('tourDone' in prefs)) localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, tourDone: true }))
        // A maioria dos testes da escrita é sobre a margem: começam na Revisão (os da Página trocam de modo).
        if (localStorage.getItem('papirus:escrita-modo') === null) localStorage.setItem('papirus:escrita-modo', 'revisao')
        // A primeira vez mais curta (partes que esperam o uso) só vale nos testes dela.
        if (!('firstSteps' in prefs)) localStorage.setItem('papirus:prefs', JSON.stringify({ ...JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}'), firstSteps: { active: false, revealed: [] } }))
        // O nascimento em cartas só nos testes dele (nos outros, a ficha criada abre direto).
        if (!('birthCards' in JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}'))) localStorage.setItem('papirus:prefs', JSON.stringify({ ...JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}'), birthCards: false }))
        // A ficha abre para ler; os testes das fichas são sobre o formulário e começam em Editar (os da leitura trocam).
        if (localStorage.getItem('papirus:ficha-vista') === null) localStorage.setItem('papirus:ficha-vista', 'editar')
        // O Editar abre em abas; os testes antigos esperam o formulário inteiro (“Tudo”). O teste das abas limpa isto.
        if (localStorage.getItem('papirus:ficha-editar-aba') === null) localStorage.setItem('papirus:ficha-editar-aba', 'tudo')
      } catch {
        // Sem armazenamento: o teste segue sem pular o tour.
      }
    })
    await provide(page)
  },
})

export { expect } from '@playwright/test'
export type { BrowserContext, Locator, Page } from '@playwright/test'
