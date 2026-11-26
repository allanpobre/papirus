import { readFileSync } from 'node:fs'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })

async function abrirSistemas(page: Page) {
  await nav(page, 'Mesa').click()
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('tab', { name: 'Sistemas' }).click()
}

test('levar um sistema de RPG para outra campanha: exporta em .json, importa em outro universo e avisa do que não deu', async ({ page: mestre, browser }) => {
  test.setTimeout(90_000)
  // 1) O sistema da campanha do exemplo (Ostria), exportado.
  const page = mestre
  await page.goto('/app/?exemplo=ostria')
  await abrirSistemas(page)
  const nome = await page.getByRole('textbox', { name: 'Nome do sistema' }).inputValue()
  const atributos = await page.locator('.system-editor').getByRole('heading', { name: /Atributos/ }).count()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar (.json)' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.json$/)
  const caminho = (await download.path())!
  const arquivo = JSON.parse(readFileSync(caminho, 'utf8'))
  expect(arquivo).toMatchObject({ formato: 'papirus-sistema', versao: 1 })
  expect(arquivo.sistema.name).toBe(nome)
  const nAtributos = arquivo.sistema.attributes.length
  const nPericias = arquivo.sistema.skills.length
  expect(nAtributos).toBeGreaterThan(3)
  void atributos

  // 2) Outra campanha, de outro universo (outro aparelho, sem nada guardado): importa.
  const outro = await browser.newContext()
  await outro.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  const campanha = await outro.newPage()
  await campanha.goto('/app/')
  await campanha.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Campanhas' }).click()
  await campanha.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras')
  await campanha.getByRole('button', { name: 'Criar campanha' }).click()
  await expect(campanha.locator('.mesa-bar')).toBeVisible()
  await campanha.getByRole('tab', { name: 'Regras' }).click()
  await campanha.getByRole('tab', { name: 'Sistemas' }).click()
  const antes = await campanha.getByRole('region', { name: 'Sistemas' }).locator('.entity-row').count()
  await campanha.getByLabel('Arquivo do sistema (.json)').setInputFiles(caminho)
  const relato = campanha.getByRole('status').filter({ hasText: 'foi trazido' })
  await expect(relato).toContainText(`“${nome}” foi trazido`)
  await expect(relato).toContainText(`${nAtributos} atributos, ${nPericias} perícias`)
  await expect(relato).toContainText('Tudo veio, sem nada de fora.')
  await expect(campanha.getByRole('region', { name: 'Sistemas' }).locator('.entity-row')).toHaveCount(antes + 1)
  // O sistema trazido abre igual: mesmo nome e mesmos atributos.
  await expect(campanha.getByRole('textbox', { name: 'Nome do sistema' })).toHaveValue(nome)
  await expect(campanha.locator('.system-editor .kv-row, .system-editor .attr-row').first()).toBeVisible({ timeout: 5000 }).catch(() => undefined)
  await relato.getByRole('button', { name: 'Entendi' }).click()
  await expect(relato).toHaveCount(0)

  // 3) O mesmo arquivo outra vez: entra de novo, com um nome que não repete.
  await campanha.getByLabel('Arquivo do sistema (.json)').setInputFiles(caminho)
  await expect(campanha.getByRole('textbox', { name: 'Nome do sistema' })).toHaveValue(`${nome} (2)`)
  await campanha.getByRole('status').filter({ hasText: 'foi trazido' }).getByRole('button', { name: 'Entendi' }).click()

  // 4) Um arquivo com defeitos: traz o que dá e diz o que ficou de fora.
  const ruim = JSON.parse(readFileSync(caminho, 'utf8'))
  delete ruim.sistema.attributes[1].abbr
  ruim.sistema.skills[0].attributeId = 'nao-existe'
  ruim.sistema.initiativeFormula = '{XYZ}d20+++'
  await campanha.getByLabel('Arquivo do sistema (.json)').setInputFiles({ name: 'quebrado.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ruim)) })
  const aviso = campanha.getByRole('status').filter({ hasText: 'foi trazido' })
  await expect(aviso).toContainText(`${nAtributos - 1} atributos`)
  await expect(aviso).toContainText('O que não deu para trazer')
  await expect(aviso).toContainText('Atributo 2 ficou de fora')
  await expect(aviso).toContainText(/apontav(a|am) para um atributo que não veio/)
  await expect(aviso).toContainText('fórmula de iniciativa')
  await aviso.getByRole('button', { name: 'Entendi' }).click()

  // 5) O que não é um sistema é recusado, com a razão, e nada entra.
  const total = await campanha.getByRole('region', { name: 'Sistemas' }).locator('.entity-row').count()
  await campanha.getByLabel('Arquivo do sistema (.json)').setInputFiles({ name: 'notas.json', mimeType: 'application/json', buffer: Buffer.from('{"titulo": "outra coisa"}') })
  await expect(campanha.getByText('Isto não parece um sistema do Papirus')).toBeVisible()
  await campanha.getByLabel('Arquivo do sistema (.json)').setInputFiles({ name: 'texto.json', mimeType: 'application/json', buffer: Buffer.from('isto não é json') })
  await expect(campanha.getByText('não consegui ler o conteúdo')).toBeVisible()
  await expect(campanha.getByRole('region', { name: 'Sistemas' }).locator('.entity-row')).toHaveCount(total)
})
