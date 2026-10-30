import { expect, test } from './fixtures.ts'

test('lixeira e histórico: apagar, recuperar e voltar como estava', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  const resumo = page.getByRole('textbox', { name: 'Resumo' })
  const original = await resumo.inputValue()
  await resumo.fill('Contrabandista. Mudei isto.')

  // Apaga a ficha (com confirmação).
  await page.getByRole('button', { name: 'Apagar ficha' }).click()
  await page.getByRole('button', { name: 'Apagar ficha' }).last().click()
  await expect(page.getByRole('button', { name: /^Kael/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Lixeira e histórico' }).click()
  const lixeira = page.getByRole('region', { name: 'Lixeira' })
  await expect(lixeira).toContainText(/Kael \(e \d+ relaç/)
  const historico = page.getByRole('region', { name: 'Histórico de mudanças' })
  await expect(historico).toContainText('Você apagou a ficha Kael')
  await expect(historico).toContainText('Você editou a ficha')

  await lixeira.getByRole('button', { name: 'Recuperar' }).click()
  await expect(lixeira).toContainText('A lixeira está vazia.')
  await expect(historico).toContainText('Você recuperou a ficha')

  // Voltar a como estava antes da edição do resumo.
  await historico.getByRole('listitem').filter({ hasText: 'editou a ficha' }).getByRole('button', { name: 'Voltar a como estava' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Resumo' })).toHaveValue(original)
})
