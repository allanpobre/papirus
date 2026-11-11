import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()

test('mundo: criar no setor Mundos, Início com o que falta, Simples e Completo', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mundos' }).click()
  await page.getByRole('textbox', { name: 'Nome do mundo' }).fill('Terras')
  await expect(page.getByRole('radio', { name: 'Simples' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Criar mundo' }).click()

  // Só worldbuilding: Mundo e Wiki no menu; sem Escrever, Publicar nem Trama (no Simples).
  await expect(page.getByRole('heading', { name: 'Comece pela primeira ficha' })).toBeVisible()
  await expect(nav(page, 'Wiki')).toBeVisible()
  await expect(nav(page, 'Escrever')).toHaveCount(0)
  await expect(nav(page, 'Trama')).toHaveCount(0)

  await page.getByRole('button', { name: 'Abrir o Mundo' }).click()
  for (const name of ['Ana', 'Vila']) {
    await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill(name)
    await page.getByRole('button', { name: 'Criar ficha' }).click()
  }

  await nav(page, 'Início').click()
  await expect(page.getByRole('button', { name: /2 fichas sem resumo/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /2 fichas soltas/ })).toBeVisible()

  // A ficha no Simples: o essencial; "Mostrar tudo" abre o resto só nela.
  await page.getByRole('button', { name: /2 fichas sem resumo/ }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await expect(page.getByText('É verdade no mundo?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostrar tudo nesta ficha' }).click()
  await expect(page.getByText('É verdade no mundo?')).toBeVisible()

  // Completo nos Ajustes: a Trama volta ao menu.
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('radio', { name: 'Completo' }).click()
  await expect(nav(page, 'Trama')).toBeVisible()
})

test('mundo: a Wiki é uma área com prévia', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mundos' }).click()
  await page.getByRole('textbox', { name: 'Nome do mundo' }).fill('Ilhas')
  await page.getByRole('button', { name: 'Criar mundo' }).click()
  await nav(page, 'Wiki').click()
  await expect(page.getByRole('heading', { name: 'Wiki do mundo' })).toBeVisible()
  await expect(page.frameLocator('iframe[title="Prévia da wiki"]').getByRole('heading', { name: 'Ilhas' })).toBeVisible()
})
