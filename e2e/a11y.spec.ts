import AxeBuilder from '@axe-core/playwright'
import { openPart } from './areas.ts'
import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: new RegExp(`^${name}`) }).first()

async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = violations.map((v) => `${where}: ${v.id} (${v.impact}) — ${v.nodes.length}× ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? ''}]`).join(' | ')}`)
  return summary
}

for (const scheme of ['light', 'dark'] as const) {
  test(`sem violações de acessibilidade em cada área (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/')
    const found: string[] = []
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.waitForTimeout(700)
    found.push(...(await audit(page, 'apresentação')))
    await page.goto('/app/')
    found.push(...(await audit(page, 'biblioteca')))
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()

    for (const area of ['Início', 'Escrever', 'Mundo', 'Trama', 'RPG', 'Ideias', 'Perguntar ao mundo', 'Ajustes e dados']) {
      const button = nav(page, area)
      if (!(await button.count())) continue
      await button.click()
      await page.waitForTimeout(400)
      found.push(...(await audit(page, area)))
    }
    // As outras partes do Mundo e da Trama.
    for (const part of ['Ligações', 'Linha do tempo', 'Mapas', 'Quem sabe o quê'] as const) {
      await openPart(page, part)
      await page.waitForTimeout(400)
      found.push(...(await audit(page, part)))
    }
    // Os outros dois momentos da escrita: o Mapa e a Página.
    for (const mode of ['Estrutura', 'Página']) {
      await nav(page, 'Escrever').click()
      await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: mode }).click()
      await page.waitForTimeout(400)
      found.push(...(await audit(page, `Escrita/${mode}`)))
    }
    for (const [part, tab] of [
      ['Preparar', 'Sessões'],
      ['Grupo', ''],
      ['Codex', ''],
      ['Regras', 'Sistemas'],
      ['Regras', 'Dados e tabelas'],
    ]) {
      await nav(page, 'Mesa').click()
      await page.getByRole('tab', { name: part, exact: true }).click()
      if (tab) await page.getByRole('tab', { name: tab, exact: true }).click()
      await page.waitForTimeout(300)
      found.push(...(await audit(page, `Mesa/${part}${tab ? `/${tab}` : ''}`)))
    }
    console.log(found.join('\n'))
    expect(found).toEqual([])
  })
}

/*
 * As peças que chegaram depois do primeiro levantamento: o livro escolhido (seletor do Início, selo nas áreas e
 * seletor da lista de cenas), o papel na ficha, o cartão da ficha nas Ligações, a página Wiki e o aviso de versão nova.
 * No celular (390 px), no claro e no escuro: sem violações do axe e com o foco do teclado indo e voltando como deveria.
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`peças novas: livro, papel, Wiki, cartão das Ligações e aviso de versão (${scheme}, celular)`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('/app/?exemplo')
    await expect(nav(page, 'Mundo')).toBeVisible()
    const found: string[] = []

    // O seletor de livro do Início: tem nome, e o teclado chega nele.
    const livro = page.getByLabel('Livro', { exact: true })
    await expect(livro).toBeVisible()
    found.push(...(await audit(page, 'Início (seletor do livro)')))
    await livro.focus()
    await expect(livro).toBeFocused()
    await livro.selectOption({ index: 3 })

    // O selo do livro nas áreas do Mundo, e o papel na ficha (editar).
    await nav(page, 'Mundo').click()
    await expect(page.locator('.book-chip')).toBeVisible()
    found.push(...(await audit(page, 'Fichas (selo do livro)')))
    await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /Dorothy/ }).first().click()
    await expect(page.getByRole('combobox', { name: /Papel na história/ }).first()).toBeVisible()
    found.push(...(await audit(page, 'Ficha de personagem (papel)')))

    // O seletor da lista de cenas (Escrever).
    await nav(page, 'Escrever').click()
    await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
    const tree = page.getByRole('complementary', { name: 'Manuscrito' })
    await expect(tree.getByLabel('Livro', { exact: true })).toBeVisible()
    found.push(...(await audit(page, 'Lista de cenas (seletor do livro)')))
    await page.keyboard.press('Escape')

    // O cartão da ficha nas Ligações: abre ao tocar numa bolinha e fecha com Esc.
    await openPart(page, 'Ligações')
    await page.locator('.node').first().click({ force: true })
    const cartao = page.getByRole('complementary', { name: 'Ficha selecionada' })
    await expect(cartao).toBeVisible()
    found.push(...(await audit(page, 'Ligações (cartão da ficha)')))
    await page.keyboard.press('Escape')
    await expect(cartao).toHaveCount(0)

    // A página Wiki.
    await openPart(page, 'Fichas')
    await page.getByRole('button', { name: 'Wiki', exact: true }).click()
    await page.waitForTimeout(500)
    found.push(...(await audit(page, 'Wiki')))

    // O aviso de versão nova: aparece, o teclado chega em "Atualizar" e em "Depois", e o contraste está bom.
    await page.evaluate(() => window.dispatchEvent(new Event('papirus:versao-nova')))
    const aviso = page.locator('.update-notice')
    await expect(aviso).toBeVisible()
    found.push(...(await audit(page, 'Aviso de versão nova')))
    await aviso.getByRole('button', { name: 'Atualizar' }).focus()
    await page.keyboard.press('Tab')
    await expect(aviso.getByRole('button', { name: 'Depois' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(aviso).toHaveCount(0)

    console.log(found.join('\n'))
    expect(found).toEqual([])
  })
}

test('a wiki aberta pelo link (celular): sem violações e com o botão Baixar ao alcance do teclado', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const { createFakeSupabase, PASSWORD, SERVER } = await import('./fakeSupabase.ts')
  const fake = createFakeSupabase()
  await fake.attach(page.context())
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('heading', { name: /As Cinzas de Ostria/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Entrar no Papirus' })
  await dialog.getByRole('textbox', { name: 'Endereço do projeto' }).fill(SERVER)
  await dialog.getByRole('textbox', { name: 'Chave pública (anon key)' }).fill('eyJ.chave-de-teste')
  await dialog.getByRole('button', { name: 'Pronto' }).click()
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('ana@exemplo.com')
  await dialog.getByLabel('Senha').fill(PASSWORD)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  const mine = page.getByRole('dialog', { name: 'Sua conta' })
  await expect(mine).toContainText('ana@exemplo.com')
  await mine.getByRole('button', { name: 'Fechar' }).click()
  await nav(page, 'Mundo').click()
  await page.getByRole('button', { name: 'Wiki', exact: true }).click()
  await page.getByRole('button', { name: 'Pegar o link da wiki' }).click()
  const share = page.getByRole('dialog', { name: 'Compartilhar' })
  await share.getByRole('button', { name: 'Começar a compartilhar' }).click()
  await share.getByRole('button', { name: 'Criar link de leitura' }).click()
  const link = await share.getByRole('textbox', { name: 'Link de leitura' }).inputValue()

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await fake.attach(context)
  const reader = await context.newPage()
  await reader.goto(`/app/${new URL(link).search}`)
  await expect(reader.getByText(/Wiki de/).first()).toBeVisible()
  await reader.frameLocator('iframe.wiki-link-frame').locator('body').waitFor()
  await reader.waitForTimeout(500)
  const found = await audit(reader, 'wiki pelo link')
  // O teclado chega no "Baixar".
  await reader.getByRole('button', { name: 'Baixar' }).focus()
  await expect(reader.getByRole('button', { name: 'Baixar' })).toBeFocused()
  // No escuro, o fundo da moldura da wiki é o papel do tema, não um branco fixo.
  await reader.emulateMedia({ colorScheme: 'dark' })
  const fundo = await reader.locator('iframe.wiki-link-frame').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(fundo, 'moldura da wiki no escuro').not.toBe('rgb(255, 255, 255)')
  console.log(found.join('\n'))
  expect(found).toEqual([])
})
