import { expect, test } from './fixtures.ts'

// Criar uma ficha com um nome que já existe avisa (auditoria 23), sem impedir.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('nova ficha com nome (ou apelido) que já existe: avisa e oferece abrir a que existe', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nova ficha' }).first().click()
  const nova = page.getByRole('dialog', { name: 'Nova ficha' })
  const aviso = nova.getByRole('status').filter({ hasText: 'Já existe' })
  await nova.getByRole('textbox', { name: 'Nome' }).fill('Seren')
  await expect(aviso).toHaveCount(0)
  // Sem diferença de maiúscula e acento.
  await nova.getByRole('textbox', { name: 'Nome' }).fill('kael')
  await expect(aviso).toContainText('Já existe Kael (personagem)')
  // Pelo apelido também.
  await nova.getByRole('textbox', { name: 'Nome' }).fill('Pale Man')
  await expect(aviso).toContainText('Homem Pálido')
  await expect(aviso).toContainText('“Pale Man” como outro nome')
  // Criar continua possível; "Abrir essa" leva à que existe.
  await expect(nova.getByRole('button', { name: 'Criar e abrir' })).toBeEnabled()
  await aviso.getByRole('button', { name: 'Abrir essa' }).click()
  await expect(nova).toHaveCount(0)
  await expect(page.locator('#entity-name')).toHaveValue('Homem Pálido')
  // E sem as cartas de nascimento: a ficha já existia.
  await expect(page.getByRole('dialog', { name: /^Nascimento/ })).toHaveCount(0)
})
