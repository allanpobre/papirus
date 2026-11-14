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

test.describe('Quem é no celular (390 px), com o exemplo de Oz', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  async function abrirLenhador(page: Page) {
    await page.goto('/app/?exemplo')
    await page.getByRole('button', { name: 'Mais', exact: true }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
    await row(page, 'Lenhador de Lata').first().click()
    await mode(page, 'Editar').click()
    const who = page.getByRole('region', { name: 'Quem é' })
    await who.scrollIntoViewIfNeeded()
    return who
  }

  test('escolher a opção, ver o que passa adiante e marcar uma exceção, tudo com alvos de toque e sem rolagem de lado', async ({ page }) => {
    const who = await abrirLenhador(page)
    const semRolagem = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    expect(await semRolagem()).toBe(true)

    // Escolher a opção (Povo): a lista tem 44 px de altura e a letra não faz o iOS ampliar a tela.
    const povo = who.getByRole('combobox', { name: 'Povo' })
    expect((await povo.boundingBox())!.height).toBeGreaterThanOrEqual(43)
    expect(await povo.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    await povo.selectOption({ label: 'Winkies' })
    const botaoAbrir = who.getByRole('button', { name: 'Abrir Winkies' })
    expect((await botaoAbrir.boundingBox())!.height).toBeGreaterThanOrEqual(36)

    // O que passa adiante: o que os Winkies têm, com a explicação do que é "Exceção".
    const traits = page.getByRole('list', { name: 'Por ser Winkies' })
    await expect(traits).toContainText('Cor')
    await expect(traits).toContainText('amarelo')
    await expect(who).toContainText('Por ser Winkies. “Exceção” muda só nesta ficha.')
    expect(await semRolagem()).toBe(true)

    // Marcar uma exceção: o botão é um alvo de toque; o padrão aparece riscado e o campo ocupa a largura toda.
    const exc = traits.getByRole('button', { name: 'Exceção' }).first()
    expect((await exc.boundingBox())!.height).toBeGreaterThanOrEqual(38)
    await exc.click()
    const campo = traits.getByRole('textbox', { name: 'Exceção: Cor' })
    const cb = (await campo.boundingBox())!
    expect(cb.height).toBeGreaterThanOrEqual(43)
    expect(cb.width).toBeGreaterThan(250)
    await expect(traits.getByText('O padrão:')).toBeVisible()
    await campo.fill('cinza')
    expect(await semRolagem()).toBe(true)
    // Na leitura, a exceção aparece junto do que era.
    await mode(page, 'Ler').click()
    await expect(page.getByRole('region', { name: 'Quem é' })).toContainText('Povo: Winkies')
    await expect(page.getByRole('region', { name: 'Quem é' })).toContainText('cinza (exceção)')

    // Desfazer a exceção volta ao padrão.
    await mode(page, 'Editar').click()
    await page.getByRole('list', { name: 'Por ser Winkies' }).getByRole('button', { name: 'Desfazer' }).first().click()
    await expect(page.getByRole('list', { name: 'Por ser Winkies' }).getByRole('textbox', { name: 'Exceção: Cor' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Por ser Winkies' })).toContainText('amarelo')
  })

  test('"Feito de" mostra o que a opção passa, a opção se edita pelo dedo e tirar um item do tipo pede confirmação', async ({ page }) => {
    const who = await abrirLenhador(page)
    // A Lata já passa coisas: com o que tem de diferente deste personagem.
    const feito = who.getByRole('list', { name: 'Por ser Lata' })
    await expect(feito).toContainText('Come e dormenão')
    await expect(feito).toContainText('Coração')

    // Abrir a opção: o que ela passa se edita em linhas que cabem na tela.
    await who.getByRole('button', { name: 'Abrir Lata' }).click()
    await mode(page, 'Editar').click()
    const passes = page.getByRole('region', { name: 'O que passa para quem é Lata' })
    await passes.scrollIntoViewIfNeeded()
    const key = passes.getByRole('textbox', { name: 'Característica', exact: true }).first()
    expect((await key.boundingBox())!.width).toBeGreaterThan(100)
    await passes.getByRole('button', { name: 'Característica', exact: true }).click()
    await expect(passes.getByRole('textbox', { name: 'Característica', exact: true })).toHaveCount(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // Voltar ao personagem: tirar "Povo" de todo personagem é de todos, então pergunta antes (e dá para desistir).
    await page.getByRole('button', { name: 'Mais', exact: true }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
    await row(page, 'Lenhador de Lata').first().click()
    await mode(page, 'Editar').click()
    const region = page.getByRole('region', { name: 'Quem é' })
    await region.getByRole('button', { name: 'Tirar Povo deste tipo' }).click()
    const pergunta = region.getByRole('group', { name: /Tirar “Povo” de todo personagem\?/ })
    await expect(pergunta).toBeVisible()
    expect((await pergunta.getByRole('button', { name: 'Tirar' }).boundingBox())!.height).toBeGreaterThanOrEqual(30)
    await pergunta.getByRole('button', { name: 'Cancelar' }).click()
    await expect(region.getByRole('combobox', { name: 'Povo' })).toBeVisible()
    // Confirmando, o item sai.
    await region.getByRole('button', { name: 'Tirar Povo deste tipo' }).click()
    await region.getByRole('group', { name: /Tirar “Povo”/ }).getByRole('button', { name: 'Tirar' }).click()
    await expect(region.getByRole('combobox', { name: 'Povo' })).toHaveCount(0)
    await expect(region.getByRole('combobox', { name: 'Feito de' })).toBeVisible()
  })
})
