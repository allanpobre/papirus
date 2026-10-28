import { expect, type Page } from '@playwright/test'

/**
 * Abre o (?) da tela e passa por todos os passos até "Entendi". Confere que o balão fica
 * dentro da tela em cada passo e que o tour fecha no fim. Devolve, por passo, o título e
 * se havia algo destacado.
 */
export async function runPageTour(page: Page, title: string) {
  await page.getByRole('button', { name: `Como usar: ${title}` }).click()
  const card = page.locator('.page-tour .tour-card')
  await expect(card).toBeVisible()
  const first = (await card.locator('.tour-count').textContent()) ?? ''
  const n = Number(first.match(/de (\d+)$/)?.[1])
  expect(n, `tour de ${title}`).toBeGreaterThan(0)
  const view = page.viewportSize()!
  const steps: { title: string; spot: boolean }[] = []
  for (let i = 1; i <= n; i++) {
    await expect(card.locator('.tour-count')).toHaveText(`${title} · ${i} de ${n}`)
    // Espera o balão parar de deslizar para medir onde ele ficou.
    await page.waitForTimeout(320)
    const box = (await card.boundingBox())!
    expect(box.y, `${title}, passo ${i}: balão acima da tela`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${title}, passo ${i}: balão abaixo da tela`).toBeLessThanOrEqual(view.height + 1)
    expect(box.x + box.width, `${title}, passo ${i}: balão fora da tela`).toBeLessThanOrEqual(view.width + 1)
    steps.push({ title: (await card.locator('.tour-title').textContent()) ?? '', spot: (await page.locator('.page-tour .tour-spot').count()) > 0 })
    await card.getByRole('button', { name: i === n ? 'Entendi' : 'Próximo' }).click()
  }
  await expect(page.locator('.page-tour')).toHaveCount(0)
  return steps
}
