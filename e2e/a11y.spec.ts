import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()

async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = violations.map((v) => `${where}: ${v.id} (${v.impact}) — ${v.nodes.length}× ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? ''}]`).join(' | ')}`)
  return summary
}

for (const scheme of ['light', 'dark'] as const) {
  test(`sem violações de acessibilidade em cada área (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/')
    const found: string[] = []
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.waitForTimeout(700)
    found.push(...(await audit(page, 'apresentação')))
    await page.goto('/app/')
    found.push(...(await audit(page, 'biblioteca')))
    await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
    await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()

    for (const area of ['Início', 'Escrever', 'Fichas', 'Relações', 'Timeline', 'Atlas', 'Tramas', 'Conhecimento', 'Organizar', 'Archivist', 'RPG', 'Inbox', 'Ajustes e dados']) {
      const button = nav(page, area)
      if (!(await button.count())) continue
      await button.click()
      await page.waitForTimeout(400)
      found.push(...(await audit(page, area)))
    }
    for (const tab of ['Na mesa', 'Sessões', 'Personagens', 'Revelações e Codex', 'Dados e tabelas', 'Sistemas']) {
      await nav(page, 'RPG').click()
      const t = page.getByRole('tab', { name: tab })
      await t.click()
      await page.waitForTimeout(300)
      found.push(...(await audit(page, `RPG/${tab}`)))
    }
    console.log(found.join('\n'))
    expect(found).toEqual([])
  })
}
