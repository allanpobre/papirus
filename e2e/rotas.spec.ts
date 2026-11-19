import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Mapas vivos: rotas com dias de viagem, o aviso de viagem rápida e uma rota nova. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('rotas: dias de viagem, aviso de viagem rápida e ligar dois lugares', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Mapas')
  // As rotas do exemplo mostram os dias pela escala.
  const trilha = page.getByRole('button', { name: /^Trilha de Torre de Marfim a Vale das Brumas: / })
  await expect(trilha).toBeVisible()
  await trilha.click()
  const edit = page.getByRole('group', { name: /^Rota de Torre de Marfim a Vale das Brumas/ })
  await expect(edit.getByLabel('Tempo de viagem')).toContainText('a cavalo')
  await edit.getByRole('radio', { name: 'Rio' }).click()
  await expect(edit.getByLabel('Tempo de viagem')).toContainText('de barco')
  await edit.getByRole('button', { name: 'Fechar' }).click()
  // O caminho de Kael: de Ostria ao Vale no mesmo dia.
  await page.locator('.atlas-more').click()
  await page.locator('.atlas-route-pick select').selectOption({ label: 'Kael' })
  await expect(page.getByRole('list', { name: 'Viagens rápidas demais' })).toContainText('Vale das Brumas')
  await page.locator('.atlas-more').click()
  // Uma rota nova: Taverna do Anzol → Paço do Regente, por mar com 2 dias.
  await page.getByRole('button', { name: 'Rota', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Ligar lugares' })).toBeVisible()
  await page.getByRole('button', { name: /^Taverna do Anzol/ }).click()
  await expect(page.getByRole('group', { name: 'Ligar lugares' })).toContainText('agora toque')
  await page.getByRole('button', { name: /^Paço do Regente/ }).click()
  const nova = page.getByRole('group', { name: 'Rota de Taverna do Anzol a Paço do Regente' })
  await nova.getByRole('radio', { name: 'Mar' }).click()
  await nova.getByLabel('Dias de barco').fill('2')
  await expect(page.getByRole('button', { name: 'Mar de Taverna do Anzol a Paço do Regente: 2 dias' })).toBeVisible()
})
