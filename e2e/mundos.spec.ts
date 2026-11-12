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

test('mundo: a semente planta as primeiras fichas, ligadas', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mundos' }).click()
  await page.getByRole('textbox', { name: 'Nome do mundo' }).fill('Brumas')
  await page.getByRole('button', { name: 'Criar mundo' }).click()
  await page.getByRole('button', { name: 'Plantar a semente' }).click()
  const seed = page.getByRole('dialog', { name: 'Semente do mundo' })
  await seed.getByRole('radio', { name: 'Um império' }).click()
  await seed.getByRole('textbox', { name: 'Nome da ameaça (opcional)' }).fill('A Névoa')
  await seed.getByRole('button', { name: 'Plantar a semente' }).click()
  await expect(page.getByRole('button', { name: /\d+ personage(m|ns)/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que falta' })).toBeVisible()
  await nav(page, 'Mundo').click()
  await expect(page.locator('.entity-row', { hasText: 'A Névoa' })).toBeVisible()
  await expect(page.locator('.entity-row', { hasText: 'Império de ' }).first()).toBeVisible()
})

test('mundo: escrever uma lenda pelo Início', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mundos' }).click()
  await page.getByRole('textbox', { name: 'Nome do mundo' }).fill('Mar Alto')
  await page.getByRole('button', { name: 'Criar mundo' }).click()
  await page.getByRole('button', { name: 'Plantar a semente' }).click()
  await page.getByRole('dialog', { name: 'Semente do mundo' }).getByRole('button', { name: 'Plantar a semente' }).click()
  await page.getByRole('button', { name: 'Escrever uma lenda' }).click()
  await expect(page.getByRole('heading', { name: 'Nova lenda' })).toBeVisible()
  await expect(page.locator('.entity-row', { hasText: 'Nova lenda' })).toContainText('Lenda ou documento')
})

test('mundo: trazer notas do Obsidian', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Mundos' }).click()
  await page.getByRole('textbox', { name: 'Nome do mundo' }).fill('Cofre')
  await page.getByRole('button', { name: 'Criar mundo' }).click()
  await page.getByRole('button', { name: 'Trazer de outro app' }).click()
  const dialog = page.getByRole('dialog', { name: 'Trazer de outro app' })
  await dialog.locator('input[type=file]').setInputFiles([
    { name: 'Kael.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntype: personagem\n---\nContrabandista do porto, irmão de [[Mira]].') },
    { name: 'Mira.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntype: character\n---\nA herdeira que não sabe quem é.') },
  ])
  await expect(dialog.getByText(/Achei 2 fichas/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Trazer 2 fichas' }).click()
  await expect(page.getByRole('button', { name: /2 personagens/ })).toBeVisible()
})
