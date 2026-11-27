import { expect, test } from './fixtures.ts'
import { fichaModo, openPart } from './areas.ts'

// Remoções que não tinham volta (auditoria 23): agora dão "Desfazer". E a janela de nova versão pergunta antes
// de descartar o que foi escrito.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function abrirKael(page: import('@playwright/test').Page) {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
}

test('tirar uma ligação e o que a ficha sabe dá Desfazer', async ({ page }) => {
  await abrirKael(page)
  await fichaModo(page, 'Editar')
  const linhas = page.locator('.relation-row')
  const antes = await linhas.count()
  await page.getByRole('button', { name: 'Editar a ligação “irmão de”' }).click()
  await page.getByRole('button', { name: /^Remover (ligação|estas ligações)$/ }).first().click()
  await expect(linhas).toHaveCount(antes - 1)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(linhas).toHaveCount(antes)
  await expect(page.locator('.relation-row', { hasText: 'irmão de' })).toHaveCount(1)

  const sabe = page.getByRole('button', { name: 'Remover', exact: true })
  const n = await sabe.count()
  expect(n).toBeGreaterThan(0)
  await sabe.first().click()
  await expect(sabe).toHaveCount(n - 1)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(sabe).toHaveCount(n)
})

test('fechar a nova versão com algo escrito pergunta antes de descartar', async ({ page }) => {
  await abrirKael(page)
  await fichaModo(page, 'Ler')
  await page.getByRole('region', { name: 'Versões' }).getByRole('button', { name: /Nova versão/ }).click()
  const janela = page.getByRole('dialog', { name: 'Nova versão de Kael' })
  // Sem escrever nada, fecha direto.
  await janela.getByRole('button', { name: 'Fechar' }).click()
  await expect(janela).toHaveCount(0)

  await page.getByRole('region', { name: 'Versões' }).getByRole('button', { name: /Nova versão/ }).click()
  await janela.getByRole('textbox', { name: 'Nome da versão' }).fill('Rei do porto')
  await janela.getByRole('button', { name: 'Fechar' }).click()
  const pergunta = janela.getByRole('alertdialog', { name: 'Descartar o que você escreveu?' })
  await expect(pergunta).toBeVisible()
  await pergunta.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(janela.getByRole('textbox', { name: 'Nome da versão' })).toHaveValue('Rei do porto')
  await page.keyboard.press('Escape')
  await pergunta.getByRole('button', { name: 'Descartar' }).click()
  await expect(janela).toHaveCount(0)
})
