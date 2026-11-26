import { readFile } from 'node:fs/promises'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { expect, test, type Page } from './fixtures.ts'
import { abrirFiltros, openPart } from './areas.ts'

// Auditoria 26, pacote 3: a Duda traz o mundo do Obsidian, põe os anos na linha do tempo, guarda uma vista da lista
// e leva tudo de volta ao Obsidian. No computador.
test.use({ viewport: { width: 1280, height: 800 } })

async function trazerMundo(page: Page) {
  await page.goto('/app/')
  await page.getByRole('button', { name: /Já tenho um mundo em outro app/ }).click()
  const zip = zipSync({
    'Meu Mundo/Personagens/Kael.md': strToU8('# Kael\nIrmão de [[Mira]]. Tem medo do mar desde a tempestade de 340.'),
    'Meu Mundo/Personagens/Mira.md': strToU8('# Mira\nNasceu em 322, no [[Porto de Varn]].'),
    'Meu Mundo/Lugares/Porto de Varn.md': strToU8('# Porto de Varn\nCidade de sal.'),
  })
  const janela = page.getByRole('dialog', { name: 'Trazer de outro app' })
  await janela.locator('input[type=file]').setInputFiles({ name: 'mundo.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })
  await janela.getByRole('button', { name: /Trazer 3 fichas/ }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
}

test('os anos escritos nas notas viram eventos da linha do tempo, com o título que ela escolher', async ({ page }) => {
  await trazerMundo(page)
  const faixa = page.getByRole('region', { name: 'Anos achados no texto' })
  await expect(faixa).toContainText('2 anos')
  await faixa.getByRole('button', { name: 'Ver e escolher' }).click()
  const lista = page.getByRole('dialog', { name: 'Anos achados no texto' })
  await expect(lista.getByRole('textbox', { name: /Título do evento de 340/ })).toHaveValue('A tempestade')
  await lista.getByRole('textbox', { name: /Título do evento de 340/ }).fill('A Grande Tempestade')
  await lista.getByRole('button', { name: 'Pôr 2 eventos' }).click()
  await expect(faixa).toHaveCount(0)
  await openPart(page, 'Linha do tempo')
  await expect(page.getByText('A Grande Tempestade').first()).toBeVisible()
})

test('filtros da lista em duas linhas, vista guardada que volta depois de recarregar', async ({ page }) => {
  await trazerMundo(page)
  const busca = (await page.getByRole('textbox', { name: 'Filtrar fichas' }).boundingBox())!
  await abrirFiltros(page)
  const tipo = page.getByRole('combobox', { name: 'Filtrar por tipo' })
  expect((await tipo.boundingBox())!.y).toBeGreaterThan(busca.y + busca.height - 1)
  await tipo.selectOption({ label: 'Personagens' })
  await page.getByRole('button', { name: 'Guardar esta vista' }).click()
  const vista = page.getByRole('group', { name: 'Vistas guardadas' }).getByRole('button', { name: 'Personagens', exact: true })
  await expect(vista).toHaveAttribute('aria-pressed', 'true')
  await tipo.selectOption({ index: 0 })
  await expect(vista).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await page.getByRole('group', { name: 'Vistas guardadas' }).getByRole('button', { name: 'Personagens', exact: true }).click()
  await abrirFiltros(page)
  await expect(page.getByRole('combobox', { name: 'Filtrar por tipo' })).toHaveValue('personagem')
  await expect(page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Porto de Varn/ })).toHaveCount(0)
})

test('levar de volta para o Obsidian: um .zip com pastas e [[ligações]]', async ({ page }) => {
  await trazerMundo(page)
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Ajustes e dados/ }).click()
  await page.getByRole('button', { name: /^Importar e wiki/ }).click()
  const baixou = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar o cofre (.zip)' }).click()
  const arquivo = await baixou
  expect(arquivo.suggestedFilename()).toMatch(/\.zip$/)
  const files = unzipSync(new Uint8Array(await readFile((await arquivo.path())!)))
  const kael = Object.keys(files).find((f) => f.endsWith('/Personagens/Kael.md'))!
  expect(kael).toBeTruthy()
  expect(strFromU8(files[kael])).toContain('Irmão de [[Mira]]')
  expect(Object.keys(files).some((f) => f.endsWith('/Lugares/Porto de Varn.md'))).toBe(true)
})
