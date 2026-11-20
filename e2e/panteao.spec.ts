import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

/* Panteão e crenças: deuses viram estrelas, filho de, lenda nova e quem acredita. No celular. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('panteão: deuses, filho de, lenda e quem acredita', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const d = page.getByRole('dialog', { name: 'Nova ficha' })
  await d.getByRole('textbox', { name: 'Nome' }).fill('Fé das Marés')
  await d.getByRole('combobox', { name: 'Tipo' }).selectOption('religiao')
  await d.getByRole('button', { name: 'Criar e abrir' }).click()
  const panel = page.locator('details.fold', { has: page.locator('summary', { hasText: 'Panteão e crenças' }) })
  await panel.locator('summary').click()
  const addGod = async (name: string, domain: string) => {
    await panel.getByRole('button', { name: 'Deus ou deusa' }).click()
    const g = panel.getByRole('group', { name: 'Novo deus' })
    await g.getByLabel('Domínio do deus').fill(domain)
    await g.getByLabel('Deus ou deusa').fill(name)
    await g.getByRole('option', { name: new RegExp(`Criar “${name}”`) }).click()
  }
  await addGod('Mãe-Mar', 'o mar')
  await addGod('Afogado', 'os que o mar levou')
  const sky = panel.getByRole('group', { name: 'Panteão de Fé das Marés' })
  await expect(sky.getByRole('button', { name: 'Mãe-Mar' })).toBeVisible()
  // O cartão do Afogado está aberto (o último que entrou): filho da Mãe-Mar.
  const card = panel.getByRole('region', { name: 'Afogado' })
  await card.getByLabel('Filho de (outro deus)').fill('Mãe')
  await card.getByRole('option', { name: /Mãe-Mar/ }).click()
  await expect(card).toContainText('Filho de Mãe-Mar')
  await expect(sky.locator('line')).toHaveCount(1)
  await card.getByRole('button', { name: 'Nova lenda' }).click()
  await expect(card).toContainText('Lenda de Afogado')
  await panel.getByLabel('Junte um povo, grupo ou pessoa').fill('Kael')
  await panel.getByRole('option', { name: /^Kael/ }).first().click()
  await expect(panel.getByLabel('Quem acredita')).toContainText('Kael')
})
