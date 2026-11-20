import { expect, test, type Page } from './fixtures.ts'

// Auditoria 18: ícones e abas de 28 a 34 px de altura precisam de uma zona de toque de 44 px.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function alcance(page: Page, nome: string | RegExp) {
  const botao = page.getByRole('button', { name: nome }).first()
  const box = (await botao.boundingBox())!
  const x = box.x + box.width / 2
  const cy = box.y + box.height / 2
  // 20 px acima e abaixo do centro (a zona de 44 px chega a 22): o toque ainda cai no botão.
  const acima = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label') ?? document.elementFromPoint(px, py)?.closest('button')?.textContent?.trim(), [x, cy - 20])
  const abaixo = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label') ?? document.elementFromPoint(px, py)?.closest('button')?.textContent?.trim(), [x, cy + 20])
  return { acima, abaixo }
}

test('os ícones e as abas do Mundo têm zona de toque de 44 px de altura', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  for (const nome of ['Rolar no mundo', 'Wiki', 'Buscar em tudo']) {
    const a = await alcance(page, nome)
    expect(a.acima, `${nome} (acima)`).toContain(nome)
    expect(a.abaixo, `${nome} (abaixo)`).toContain(nome)
  }
})
