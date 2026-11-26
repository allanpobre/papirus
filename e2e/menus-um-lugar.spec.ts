import { strToU8, zipSync } from 'fflate'
import { expect, test } from './fixtures.ts'

// Pacote A (personas, menus): na Nova cara, cada coisa num lugar. No computador.
test.use({ viewport: { width: 1280, height: 800 } })

test('a primeira tela chama o setor de “Campanhas”; dentro do universo, a Mesa é onde se joga', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('papirus:cara-antiga', '0'))
  await page.goto('/app/')
  const setores = page.getByRole('navigation', { name: 'Setores' })
  await expect(setores.getByRole('button')).toHaveText([/Escrita/, /Campanhas/, /Oficina/, /Comunidade/])
  await setores.getByRole('button', { name: 'Campanhas' }).click()
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras de Varn')
  await page.getByRole('button', { name: 'Criar campanha' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mesa/ }).first()).toBeVisible()
})

test('quem traz um mundo pronto vê todas as partes, mesmo na primeira vez', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('pv-feito')) return
    localStorage.setItem('pv-feito', '1')
    localStorage.setItem('papirus:cara-antiga', '0')
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, firstSteps: { active: true, revealed: [] } }))
  })
  await page.goto('/app/')
  await page.getByRole('button', { name: /Já tenho um mundo em outro app/ }).click()
  const zip = zipSync({ 'Mundo/Personagens/Kael.md': strToU8('# Kael\nNasceu no [[Porto]].'), 'Mundo/Lugares/Porto.md': strToU8('# Porto\nCidade.') })
  const janela = page.getByRole('dialog', { name: 'Trazer de outro app' })
  await janela.locator('input[type=file]').setInputFiles({ name: 'mundo.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })
  await janela.getByRole('button', { name: /Trazer 2 fichas/ }).click()
  // Na Nova cara, a Linha do tempo mora na História; sem datas ainda, ela aparece mesmo assim.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'História', exact: true }).click()
  await expect(page.locator('[data-tour="partes"]').getByRole('button', { name: /Linha do tempo|Tempo/ })).toBeVisible()
})
