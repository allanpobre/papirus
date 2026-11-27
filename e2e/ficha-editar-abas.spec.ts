import { expect, test } from './fixtures.ts'
import { fichaModo, openPart } from './areas.ts'

// A ficha em Editar vem em abas (auditoria 23, H8.1), com a barra de Versões no alto. No celular.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

test('Editar em abas: Básico primeiro, cada parte na sua aba, Tudo e a aba lembrada; Versões no alto', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.getItem('aba-limpa') || (localStorage.removeItem('papirus:ficha-editar-aba'), localStorage.setItem('aba-limpa', '1')))
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Editar')

  const abas = page.getByRole('navigation', {
    name: 'Partes da ficha para editar',
  })
  await expect(abas.getByRole('button')).toHaveText(['Básico', 'Ligações', 'Mundo', 'Tempo', 'Referências', 'Tudo'])
  await expect(abas.getByRole('button', { name: 'Básico' })).toHaveAttribute('aria-current', 'page')
  // Básico: a descrição, sem as ligações.
  await expect(page.getByText('Descrição', { exact: true })).toBeVisible()
  await expect(page.locator('.relation-row')).toHaveCount(0)

  await abas.getByRole('button', { name: 'Ligações' }).click()
  await expect(page.locator('.relation-row').first()).toBeVisible()
  await expect(page.getByText('Descrição', { exact: true })).toHaveCount(0)

  await abas.getByRole('button', { name: 'Tempo' }).click()
  await expect(page.getByRole('heading', { name: /Ao longo da história/ })).toBeVisible()

  // A barra de Versões também em Editar: “Nova versão” abre a janela.
  await page
    .getByRole('region', { name: 'Versões' })
    .getByRole('button', { name: /Nova versão/ })
    .click()
  await expect(page.getByRole('dialog', { name: 'Nova versão de Kael' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Nova versão de Kael' }).getByRole('button', { name: 'Fechar' }).click()

  // Tudo: o formulário inteiro; e a aba fica lembrada.
  await abas.getByRole('button', { name: 'Tudo' }).click()
  await expect(page.locator('.relation-row').first()).toBeVisible()
  await expect(page.getByText('Descrição', { exact: true })).toBeVisible()
  await page.reload()
  await fichaModo(page, 'Editar')
  await expect(page.getByRole('navigation', { name: 'Partes da ficha para editar' }).getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-current', 'page')
})
