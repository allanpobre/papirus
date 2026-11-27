import { expect, test } from './fixtures.ts'

/*
 * Primeira vez mais curta, no celular: no primeiro universo, o Mundo começa só com as Fichas; as Ligações
 * aparecem com duas fichas; "Mostrar todas" traz o resto, e a escolha fica.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('primeiro universo: as partes do Mundo aparecem conforme o uso', async ({ page }) => {
  // Este teste é sobre a primeira vez: tira o "já usava" que os outros testes ganham.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('primeira-vez')) return
    sessionStorage.setItem('primeira-vez', '1')
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    delete prefs.firstSteps
    localStorage.setItem('papirus:prefs', JSON.stringify(prefs))
  })
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Primeiro')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()

  const partes = page.getByRole('navigation', { name: 'Partes do mundo' }).or(page.getByRole('group', { name: 'Partes do mundo' }))
  await expect(page.getByText('Mais partes aparecem conforme você usa')).toBeVisible()
  await expect(partes.getByRole('button', { name: /Ligações/ })).toHaveCount(0)

  // Duas fichas: as Ligações aparecem.
  for (const nome of ['Ana', 'Bento']) {
    await page.getByRole('button', { name: 'Nova ficha' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova ficha' })
    await dialog.getByRole('textbox', { name: 'Nome' }).fill(nome)
    await dialog.getByRole('button', { name: 'Criar e fazer outra' }).click()
    await dialog.getByRole('button', { name: 'Fechar' }).click()
  }
  await expect(partes.getByRole('button', { name: /Ligações/ })).toBeVisible()
  await expect(partes.getByRole('button', { name: /Tempo|Linha do tempo/ })).toHaveCount(0)

  // "Mostrar todas" traz o resto, e continua assim depois de recarregar.
  await page.getByRole('button', { name: 'Mostrar todas' }).click()
  await expect(partes.getByRole('button', { name: 'Mapas' })).toBeVisible()
  await expect(page.getByText('Mais partes aparecem conforme você usa')).toHaveCount(0)
  await page.reload()
  await expect(partes.getByRole('button', { name: /Mapas/ })).toBeVisible()
})
