import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Culturas vivas: cartas viram campos, "Um dia na vida" e festas na Linha do tempo. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('cultura viva: cartas, um dia na vida e festa na linha do tempo', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const d = page.getByRole('dialog', { name: 'Nova ficha' })
  await d.getByRole('textbox', { name: 'Nome' }).fill('Gente do Sal')
  await d.getByRole('combobox', { name: 'Tipo' }).selectOption('cultura')
  await d.getByRole('button', { name: 'Criar e abrir' }).click()
  const oficina = page.locator('details.fold', { has: page.locator('summary', { hasText: 'Oficina da cultura' }) })
  await oficina.locator('summary').click()
  const cartas = oficina.getByRole('group', { name: 'Cartas da cultura' })
  await cartas.getByRole('button', { name: /Comida/ }).click()
  await oficina.getByRole('button', { name: 'pão de cinza e peixe seco' }).click()
  await oficina.getByRole('button', { name: 'Guardar' }).click()
  await cartas.getByRole('button', { name: /Tabu/ }).click()
  await oficina.locator('#culture-answer').fill('comer sozinho')
  await oficina.getByRole('button', { name: 'Guardar' }).click()
  await expect(oficina.locator('.culture-day')).toContainText('No almoço, pão de cinza e peixe seco.')
  await oficina.getByLabel('Nome da festa').fill('Primeira Chuva')
  await oficina.getByRole('button', { name: 'Festa', exact: true }).click()
  await expect(oficina.getByRole('list', { name: 'Festas' })).toContainText('Primeira Chuva')
  await openPart(page, 'Linha do tempo')
  await expect(page.getByRole('region', { name: 'Festas de todo ano' })).toContainText('Gente do Sal')
})
