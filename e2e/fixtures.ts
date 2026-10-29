import { test as base } from '@playwright/test'

/** Testes que não são sobre o tour começam com ele já visto, para não ficar por cima da tela. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
        if (!('tourDone' in prefs)) localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, tourDone: true }))
      } catch {
        // Sem armazenamento: o teste segue sem pular o tour.
      }
    })
    await provide(page)
  },
})

export { expect } from '@playwright/test'
export type { BrowserContext, Locator, Page } from '@playwright/test'
