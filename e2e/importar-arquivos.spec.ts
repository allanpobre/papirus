import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'
import { expect, test, type Page } from './fixtures.ts'
import { fichaModo } from './areas.ts'

/*
 * Trazer de outro app com arquivos no formato de exportação de cada um (e2e/fixtures/importar), pela tela de verdade.
 * Não são exportações reais dos apps: foram escritos à mão a partir de como cada um guarda as coisas.
 */
const raiz = join(process.cwd(), 'e2e/fixtures/importar')
const caminhos = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? caminhos(join(dir, n)) : [join(dir, n)]))
const zip = (sub: string) => {
  const files: Record<string, Uint8Array> = {}
  for (const p of caminhos(join(raiz, sub))) files[relative(join(raiz, sub), p).replace(/\\/g, '/')] = new Uint8Array(readFileSync(p))
  return Buffer.from(zipSync(files))
}

const mundo = (page: Page) => page.getByRole('region', { name: /mundo/ })

async function universoNovo(page: Page, nome: string) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill(nome)
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(page.getByRole('heading', { name: 'Comece o mundo' })).toBeVisible()
}

async function trazer(page: Page, arquivos: { name: string; mimeType: string; buffer: Buffer }[]) {
  await mundo(page).getByRole('button', { name: 'Trazer de outro app' }).click()
  const janela = page.getByRole('dialog', { name: 'Trazer de outro app' })
  await janela.locator('input[type=file]').setInputFiles(arquivos)
  return janela
}

test('o cofre do Obsidian em .zip: fichas por pasta, campos, links limpos e o retrato que a nota mostrava', async ({ page }) => {
  await universoNovo(page, 'Cofre de Valmar')
  const janela = await trazer(page, [{ name: 'Cofre de Valmar.zip', mimeType: 'application/zip', buffer: zip('obsidian') }])
  await expect(janela.getByText(/Achei 6 fichas \(Obsidian \(Markdown\)\)/)).toBeVisible()
  await expect(janela.getByText('1 com imagem.')).toBeVisible()
  await janela.getByRole('button', { name: 'Trazer 6 fichas' }).click()
  await expect(page.getByText('6 fichas trazidas, 1 com imagem.')).toBeVisible()

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.locator('.entity-row', { hasText: 'Kael Arvoredo' }).first().click()
  // A ficha tem o retrato da nota e os campos do cabeçalho; o texto veio limpo.
  await expect(page.locator('.entity-detail, .entity-side, .split-detail').locator('img').first()).toBeVisible()
  await fichaModo(page, 'Ler')
  const ficha = page.locator('.split-detail, .entity-detail').first()
  await expect(ficha).toContainText('Idade')
  await expect(ficha).toContainText('Porto Velho')
  await expect(ficha).toContainText('Irmão de Mira Arvoredo e devedor da Casa Valmar.')
  await expect(ficha).not.toContainText('[[')
  await expect(ficha).not.toContainText('dataview')
  // O molde de personagem (pasta Modelos) não virou ficha.
  await expect(page.locator('.entity-row', { hasText: '{{title}}' })).toHaveCount(0)
})

test('a exportação do Kanka: o tipo vem do arquivo, o que era privado vira segredo e as menções não somem do texto', async ({ page }) => {
  await universoNovo(page, 'Campanha Kanka')
  const arquivos = readdirSync(join(raiz, 'kanka')).map((name) => ({ name, mimeType: 'application/json', buffer: readFileSync(join(raiz, 'kanka', name)) }))
  const janela = await trazer(page, arquivos)
  await expect(janela.getByText(/Achei 6 fichas \(Kanka\)/)).toBeVisible()
  await expect(janela.getByText('1 era privada no outro app e vira segredo aqui.')).toBeVisible()
  await janela.getByRole('button', { name: 'Trazer 6 fichas' }).click()

  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.locator('.entity-row', { hasText: 'Aldric Valmar' }).first().click()
  await fichaModo(page, 'Ler')
  const ficha = page.locator('.split-detail, .entity-detail').first()
  await expect(ficha).toContainText('Aldric governa Valmar com mão de ferro')
  await expect(ficha).toContainText('Rei de Valmar')
  await expect(ficha).toContainText('ele/dele')
  // Brant era privado no Kanka: entra como segredo, então não aparece na wiki (e Aldric, que era público, sim).
  await page.getByRole('button', { name: 'Wiki', exact: true }).click()
  const wiki = page.frameLocator('iframe[title="Prévia da wiki"]')
  await expect(wiki.locator('h2', { hasText: /^Aldric Valmar$/ })).toBeAttached()
  await expect(wiki.locator('h2', { hasText: /^Brant Valmar$/ })).toHaveCount(0)
})

test('os artigos do World Anvil: a lista {"articles": [...]} é lida, o BBCode vira texto e o privado vira segredo', async ({ page }) => {
  await universoNovo(page, 'Anvil de Teste')
  const janela = await trazer(page, [{ name: 'articles.json', mimeType: 'application/json', buffer: readFileSync(join(raiz, 'worldanvil/articles.json')) }])
  await expect(janela.getByText(/Achei 4 fichas \(World Anvil\)/)).toBeVisible()
  await expect(janela.getByText('1 era privada no outro app e vira segredo aqui.')).toBeVisible()
  await janela.getByRole('button', { name: 'Trazer 4 fichas' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click()
  await page.locator('.entity-row', { hasText: 'Lyra, a Cartógrafa' }).first().click()
  await fichaModo(page, 'Ler')
  const ficha = page.locator('.split-detail, .entity-detail').first()
  await expect(ficha).toContainText('Nascida em Porto Velho')
  await expect(ficha).toContainText('Atlas do sul')
  await expect(ficha).not.toContainText('[h1]')
  await expect(ficha).not.toContainText('@[')
})
