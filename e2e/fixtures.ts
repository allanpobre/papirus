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
      } catch {
        // Sem armazenamento: o teste segue sem pular o tour.
      }
    })
    await provide(page)
  },
})

export { expect } from '@playwright/test'
export type { BrowserContext, Locator, Page } from '@playwright/test'
