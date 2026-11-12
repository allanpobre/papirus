import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()
const world = (page: Page) => page.getByRole('region', { name: /mundo/ })

/** Um universo novo, em branco: o Mundo dele é o worldbuilding (não há universo só de mundo). */
async function newUniverse(page: Page, name: string) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill(name)
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(page.getByRole('heading', { name: 'Comece o mundo' })).toBeVisible()
}

test('o mundo no Início: o que falta, e Simples ou Completo em qualquer universo', async ({ page }) => {
  await newUniverse(page, 'Terras')
  await nav(page, 'Mundo').click()
  for (const name of ['Ana', 'Vila']) {
    await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill(name)
    await page.getByRole('button', { name: 'Criar ficha' }).click()
  }
  await nav(page, 'Início').click()
  await expect(world(page).getByRole('button', { name: /2 fichas sem resumo/ })).toBeVisible()
  await expect(world(page).getByRole('button', { name: /2 fichas soltas/ })).toBeVisible()

  // Simples (em Ajustes › Universo): a ficha mostra o essencial e a Trama sai do menu.
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('radio', { name: 'Simples' }).click()
  await expect(nav(page, 'Trama')).toHaveCount(0)
  await nav(page, 'Início').click()
  await world(page).getByRole('button', { name: /2 fichas sem resumo/ }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await expect(page.getByText('É verdade no mundo?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostrar tudo nesta ficha' }).click()
  await page.getByText('Mais opções', { exact: true }).click()
  await expect(page.getByText('É verdade no mundo?')).toBeVisible()
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('radio', { name: 'Completo' }).click()
  await expect(nav(page, 'Trama')).toBeVisible()
})

test('a semente planta as primeiras fichas, e a wiki tem prévia', async ({ page }) => {
  await newUniverse(page, 'Brumas')
  await world(page).getByRole('button', { name: 'Plantar a semente' }).click()
  const seed = page.getByRole('dialog', { name: 'Semente do mundo' })
  await seed.getByRole('radio', { name: 'Um império' }).click()
  await seed.getByRole('textbox', { name: 'Nome da ameaça (opcional)' }).fill('A Névoa')
  await seed.getByRole('button', { name: 'Plantar a semente' }).click()
  await expect(page.getByRole('heading', { name: 'O que falta no mundo' })).toBeVisible()
  await nav(page, 'Mundo').click()
  await expect(page.locator('.entity-row', { hasText: 'A Névoa' })).toBeVisible()
  await expect(page.locator('.entity-row', { hasText: 'Império de ' }).first()).toBeVisible()
  await nav(page, 'Início').click()
  await world(page).getByRole('button', { name: 'Wiki' }).click()
  await expect(page.getByRole('heading', { name: 'Wiki do mundo' })).toBeVisible()
  await expect(page.frameLocator('iframe[title="Prévia da wiki"]').getByRole('heading', { name: 'Brumas' })).toBeVisible()
})

test('escrever uma lenda pelo Início', async ({ page }) => {
  await newUniverse(page, 'Mar Alto')
  await world(page).getByRole('button', { name: 'Escrever uma lenda' }).click()
  await expect(page.getByRole('heading', { name: 'Nova lenda' })).toBeVisible()
  await expect(page.locator('.entity-row', { hasText: 'Nova lenda' })).toContainText('Lenda ou documento')
})

test('trazer notas do Obsidian', async ({ page }) => {
  await newUniverse(page, 'Cofre')
  await world(page).getByRole('button', { name: 'Trazer de outro app' }).click()
  const dialog = page.getByRole('dialog', { name: 'Trazer de outro app' })
  await dialog.locator('input[type=file]').setInputFiles([
    { name: 'Kael.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntype: personagem\n---\nContrabandista do porto, irmão de [[Mira]].') },
    { name: 'Mira.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntype: character\n---\nA herdeira que não sabe quem é.') },
  ])
  await expect(dialog.getByText(/Achei 2 fichas/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Trazer 2 fichas' }).click()
  await expect(page.getByRole('navigation', { name: 'O seu mundo' })).toContainText('2 fichas')
})
