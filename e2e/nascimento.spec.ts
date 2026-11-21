import { expect, test } from './fixtures.ts'

// Criar uma ficha e abrir: as cartas do nascimento (rosto, faíscas com o dado, lugar no mundo) e a carta pronta.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function nova(page: import('@playwright/test').Page, nome: string) {
  // Os outros testes começam sem as cartas; aqui elas ficam ligadas (o padrão do app).
  await page.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
    localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, birthCards: true }))
  })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mundo', exact: true }).first().click()
  await page.getByRole('button', { name: 'Nova ficha' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova ficha' })
  await d.getByRole('textbox', { name: 'Nome' }).fill(nome)
  await d.getByRole('button', { name: 'Criar e abrir' }).click()
  return page.getByRole('dialog', { name: `Nascimento: ${nome}` })
}

test('a ficha nasce em cartas: uma linha, faíscas sorteadas do mundo, ligações, e a carta pronta', async ({ page }) => {
  const cartas = await nova(page, 'Seren')
  await expect(cartas).toBeVisible()
  await expect(cartas.getByRole('region', { name: 'Rosto' })).toBeVisible()
  await cartas.getByRole('textbox', { name: 'Em uma linha' }).fill('Faroleira que ouve o mar falar.')
  await cartas.getByRole('button', { name: /Próxima/ }).click()

  // Faísca 1: o dado preenche com algo do mundo (ou o exemplo da pergunta).
  await expect(cartas.getByRole('region', { name: 'Faísca' })).toContainText('Faísca 1 de 4')
  const resposta = cartas.getByRole('textbox', { name: 'O que quer, mais que tudo?' })
  await cartas.getByRole('button', { name: 'Sortear do meu mundo' }).click()
  await expect(resposta).not.toHaveValue('')
  const objetivo = await resposta.inputValue()
  await cartas.getByRole('button', { name: /Próxima/ }).click()
  await cartas.getByRole('textbox', { name: 'Do que tem medo?' }).fill('De água funda')
  for (let i = 0; i < 3; i++) await cartas.getByRole('button', { name: /Próxima/ }).click()

  // Lugar no mundo: liga a Kael e a Ostria.
  const lista = cartas.getByRole('list', { name: 'Fichas para ligar' })
  await lista.getByRole('button', { name: 'Kael', exact: true }).click()
  await cartas.getByRole('group', { name: 'Como se liga a Kael' }).getByRole('button', { name: 'rival de' }).click()
  await lista.getByRole('button', { name: 'Ostria', exact: true }).click()
  await cartas.getByRole('group', { name: 'Como se liga a Ostria' }).getByRole('button', { name: 'nasceu em' }).click()
  await expect(lista.getByRole('button', { name: 'rival de Kael' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await cartas.getByRole('button', { name: /Dar vida/ }).click()

  // A carta pronta: nome, a linha, as faíscas e as ligações.
  const pronta = cartas.getByRole('region', { name: 'Nasceu' })
  await expect(pronta).toContainText('Seren')
  await expect(pronta).toContainText('Faroleira que ouve o mar falar.')
  await expect(pronta).toContainText(objetivo)
  await expect(pronta).toContainText('De água funda')
  await expect(pronta).toContainText('rival de Kael · nasceu em Ostria')
  await pronta.getByRole('button', { name: 'Ver a ficha' }).click()
  await expect(cartas).toHaveCount(0)

  // Na ficha: tudo guardado de verdade (campos e ligações).
  const ficha = page.locator('main')
  await expect(ficha.getByRole('textbox', { name: 'Do que tem medo?' })).toHaveValue('De água funda')
  await expect(ficha).toContainText('Faroleira que ouve o mar falar.')
  await expect(ficha).toContainText('rival deKael')
})

test('pular o nascimento leva direto à ficha, com o que já foi escrito', async ({ page }) => {
  const cartas = await nova(page, 'Ilmar')
  await cartas.getByRole('textbox', { name: 'Em uma linha' }).fill('Carpinteiro de navios.')
  await cartas.getByRole('button', { name: 'Pular' }).click()
  await expect(cartas).toHaveCount(0)
  await expect(page.locator('main')).toContainText('Ilmar')
})
