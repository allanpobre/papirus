import { expect, test } from './fixtures.ts'
import { fichaModo, openPart, abaFicha } from './areas.ts'

/*
 * "Aparece em" na ficha, no celular: a tira com todas as cenas (as do personagem acesas), o nome em
 * destaque no trecho, o papel de cada cena com nome claro, e tocar abre a cena já no nome.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('a ficha mostra onde o personagem aparece, com o nome em destaque, e abre a cena no lugar certo', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Fichas')
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')

  await abaFicha(page, 'Diário')
  const resumo = page.locator('.appear-sum')
  await expect(resumo).toContainText(/Em \d+ de \d+ cenas/)
  const [em, de] = ((await resumo.innerText()).match(/Em (\d+) de (\d+)/) ?? []).slice(1).map(Number)
  expect(em).toBeGreaterThan(0)
  expect(de).toBeGreaterThanOrEqual(em)
  // A tira tem uma casinha por cena; só as dele são botões.
  const tira = page.getByRole('group', { name: 'Onde aparece, cena a cena' })
  await expect(tira.locator('.presence-dot')).toHaveCount(de)
  await expect(tira.getByRole('button')).toHaveCount(em)
  // O papel em palavras (nada de "POV"), e o nome marcado no trecho.
  const cenas = page.getByRole('list', { name: 'Cenas' })
  await expect(cenas.locator('.appear-role.is-pov').first()).toHaveText('ponto de vista')
  await expect(cenas.locator('.appear-name').first()).toHaveText('Kael')
  await expect(cenas).not.toContainText('POV')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Tocar na cena abre Escrever já procurando o nome, no primeiro lugar em que ele aparece, sem abrir o teclado.
  const primeira = cenas.locator('li').filter({ has: page.locator('.appear-name') }).first()
  const titulo = (await primeira.locator('.appear-title').innerText()).trim()
  await primeira.locator('.appear-open').click()
  const busca = page.getByRole('search', { name: 'Procurar na cena' })
  await expect(busca).toBeVisible()
  await expect(busca.getByRole('textbox', { name: 'Procurar na cena' })).toHaveValue('Kael')
  await expect(busca.locator('.find-count')).toContainText(/^1 de \d+/)
  await expect(page.locator('.scene-text .search-hit.is-current')).toBeInViewport()
  await expect(busca.getByRole('textbox', { name: 'Procurar na cena' })).not.toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue(titulo === 'Sem título' ? '' : titulo)
})
