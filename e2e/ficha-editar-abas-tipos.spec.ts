import { expect, test, type Page } from './fixtures.ts'
import { fichaModo } from './areas.ts'

// As abas do Editar em cada tipo: “Mundo” só aparece quando há o que mostrar ali; e com a Nova cara também.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const abas = (page: Page) => page.getByRole('navigation', { name: 'Partes da ficha para editar' })

async function editar(page: Page, nome: RegExp) {
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: nome }).first().click()
  await fichaModo(page, 'Editar')
  await abas(page).getByRole('button', { name: 'Mundo' }).or(abas(page).getByRole('button', { name: 'Básico' })).first().waitFor()
}

test('cada tipo com a sua aba Mundo (ou sem ela)', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.getItem('aba-limpa') || (localStorage.removeItem('papirus:ficha-editar-aba'), localStorage.setItem('aba-limpa', '1')))
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()

  // Lugar: poder e tensões.
  await editar(page, /^Torre de Marfim/)
  await abas(page).getByRole('button', { name: 'Mundo' }).click()
  await expect(page.getByRole('heading', { name: /^Poder e tensões/ })).toBeVisible()

  // Crença: o panteão.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await editar(page, /^Fé da Maré/)
  await abas(page).getByRole('button', { name: 'Mundo' }).click()
  await expect(page.getByRole('heading', { name: /^Panteão e crenças/ })).toBeVisible()

  // Artefato: os poderes.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await editar(page, /^Lâmina de vidro negro/)
  await abas(page).getByRole('button', { name: 'Mundo' }).click()
  await expect(page.getByRole('heading', { name: /^Poderes/ })).toBeVisible()

  // Lenda ou documento: nada de Mundo.
  await page.getByRole('button', { name: 'Voltar para a lista' }).click()
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const nova = page.getByRole('dialog', { name: 'Nova ficha' })
  await nova.getByRole('textbox', { name: 'Nome' }).fill('A canção do farol')
  await nova.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Lenda ou documento' })
  await nova.getByRole('button', { name: 'Criar e abrir' }).click()
  await fichaModo(page, 'Editar')
  await expect(abas(page).getByRole('button', { name: 'Básico' })).toBeVisible()
  await expect(abas(page).getByRole('button', { name: 'Mundo' })).toHaveCount(0)
})

test('com a Nova cara: “Editar tudo de uma vez” abre com as abas', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('aba-limpa')) return
    localStorage.removeItem('papirus:ficha-editar-aba')
    localStorage.setItem('aba-limpa', '1')
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, novaCara: true }))
  })
  await page.goto('/app/?exemplo=ostria')
  // Com mapa, a Nova cara abre o Mundo no mapa: vai para as Fichas.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('navigation', { name: 'Partes do mundo' }).getByRole('button', { name: 'Fichas' }).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Editar')
  await expect(abas(page).getByRole('button')).toHaveText(['Básico', 'Ligações', 'Mundo', 'Tempo', 'Referências', 'Tudo'])
  await abas(page).getByRole('button', { name: 'Ligações' }).click()
  await expect(page.locator('.relation-row').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Versões' })).toBeVisible()
})
