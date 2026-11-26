import { expect, test } from './fixtures.ts'

// Auditoria 24, pacote 1: as telas apertadas do celular (Mapas, Trama, barra de baixo, “Salvo”, Biblioteca).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('Mapas no celular: ferramentas em poucas linhas, nomes na lista de Lugares, toque abre o marcador', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.locator('[data-tour="partes"], nav[aria-label="Partes do mundo"]').first().getByRole('button', { name: 'Mapas' }).click()
  const lugares = page.locator('.atlas-places')
  await expect(lugares.getByText('Cidade das Esmeraldas')).toBeVisible()
  // As abas de “Adicionar mapa” e “Gerar” ficam só com o desenho, mas com nome para quem lê a tela.
  await expect(page.getByRole('button', { name: 'Adicionar mapa' })).toBeVisible()
  await expect(page.getByText('Adicionar mapa', { exact: true })).toBeHidden()
  // O nome do mapa só aparece em “Mais”.
  await expect(page.getByRole('textbox', { name: 'Nome do mapa' })).toBeHidden()
  // O nome do marcador não fica em cima do mapa inteiro; sai da lista.
  await expect(page.locator('.atlas-image .pin-label').first()).toBeHidden()
  await lugares.getByText('Cidade das Esmeraldas').click()
  await expect(lugares.getByText('Cidade das Esmeraldas')).toBeVisible()
  await expect(page.locator('.pin.selected .pin-label')).toBeVisible()
  // O mapa não é mais “espremido”: ele aparece inteiro e com folga acima da barra de baixo.
  const mapa = (await page.locator('.atlas-scroll').boundingBox())!
  expect(mapa.width).toBeGreaterThan(340)
  expect(mapa.y).toBeLessThan(260)
})

test('Trama no celular: os quatro estados cabem na barra de pular', async ({ page }) => {
  await page.goto('/app/?exemplo')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Trama' }).click()
  const pular = page.getByRole('group', { name: 'Ir para a coluna' })
  const barra = (await pular.boundingBox())!
  const ultimo = (await pular.getByRole('button').last().boundingBox())!
  expect(ultimo.x + ultimo.width).toBeLessThanOrEqual(barra.x + barra.width + 2)
})

test('barra de baixo com “Ajustes” curto; Biblioteca mostra “abrir o exemplo” sem rolar', async ({ page }) => {
  await page.goto('/app/')
  const abrir = page.getByRole('button', { name: /Ou abrir o exemplo pronto/ })
  await expect(abrir).toBeInViewport()
  await abrir.click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Áreas' })
  await nav.getByRole('button', { name: /^(Mais|Menu)/ }).click()
  await page.getByRole('group', { name: 'Ferramentas' }).getByRole('button', { name: /^Ajustes/ }).click()
  await expect(nav.getByRole('button', { name: /Ajustes e dados/ })).toHaveText('Ajustes')
})
