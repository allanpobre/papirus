import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })
const row = (page: Page, name: string) => page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: new RegExp(`^${name}$`) }) })
const mode = (page: Page, name: 'Ler' | 'Editar') => page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name })

test('Quem é: o mundo diz o que define alguém, a opção passa o que tem e a ficha pode ser exceção', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Mundo').click()
  await row(page, 'Kael').click()
  await mode(page, 'Editar').click()

  // Num mundo cyberpunk, o que define é o corpo.
  const who = page.getByRole('region', { name: 'Quem é' })
  await who.getByRole('button', { name: 'O que define' }).click()
  await who.getByRole('textbox', { name: 'O que define' }).fill('Corpo')
  await who.getByRole('button', { name: 'Criar' }).click()
  await who.getByRole('combobox', { name: 'Corpo' }).selectOption('__nova')
  await who.getByRole('textbox', { name: 'Nova opção de Corpo' }).fill('Meio-ciborgue')
  await who.getByRole('button', { name: 'Criar' }).click()
  await expect(who.getByRole('combobox', { name: 'Corpo' })).toHaveValue(/.+/)

  // Na opção: o que passa para quem é assim.
  await who.getByRole('button', { name: 'Abrir Meio-ciborgue' }).click()
  await mode(page, 'Editar').click()
  const passes = page.getByRole('region', { name: 'O que passa para quem é Meio-ciborgue' })
  await passes.getByRole('button', { name: 'Característica' }).click()
  await passes.getByRole('textbox', { name: 'Característica', exact: true }).fill('Sente frio')
  await passes.getByRole('textbox', { name: 'Valor de Sente frio' }).fill('não')
  await expect(passes).toContainText('1 ficha agora')

  // De volta ao Kael: herda, e vira exceção.
  await nav(page, 'Mundo').click()
  await row(page, 'Kael').click()
  await mode(page, 'Editar').click()
  const traits = page.getByRole('list', { name: 'Por ser Meio-ciborgue' })
  await expect(traits).toContainText('Sente frio')
  await traits.getByRole('button', { name: 'Exceção' }).click()
  await traits.getByRole('textbox', { name: 'Exceção: Sente frio' }).fill('sim')
  await mode(page, 'Ler').click()
  const read = page.getByRole('region', { name: 'Quem é' })
  await expect(read).toContainText('Corpo: Meio-ciborgue')
  await expect(read).toContainText('sim (exceção)')

  // Vale também para reinos: o convite aparece na ficha do reino.
  await nav(page, 'Mundo').click()
  await row(page, 'Reino de Ostria').click()
  await mode(page, 'Editar').click()
  await expect(page.getByRole('region', { name: 'Quem é' })).toContainText('O que define reino ou plano neste mundo?')
  await expect(page.getByRole('region', { name: 'Quem é' }).getByRole('button', { name: 'Corpo' })).toBeVisible()
})
