import { expect, test, type Locator, type Page } from './fixtures.ts'

/*
 * O caminho de quem nunca mestrou, no celular (390 px), contando os toques:
 * criar a campanha, escolher o sistema, criar 2 personagens, começar a sessão, fazer um combate com
 * 3 inimigos do bestiário, rolar dados e encerrar.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

function counter() {
  let taps = 0
  return {
    tap: async (l: Locator) => {
      taps++
      await l.click()
    },
    /** Escolher numa lista também é um toque. */
    pick: async (l: Locator, label: string | RegExp) => {
      taps++
      await l.selectOption({ label: typeof label === 'string' ? label : (await l.locator('option').allTextContents()).find((t) => label.test(t))! })
    },
    taps: () => taps,
  }
}

/** A tela não pode ficar mais larga que o aparelho (rolagem de lado = algo não coube). */
const semRolagemDeLado = async (page: Page, onde: string) => {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  expect(sobra, `rolagem de lado em: ${onde}`).toBeLessThanOrEqual(1)
}

test('mestre de primeira viagem no celular: da campanha ao fim da sessão', async ({ page }) => {
  test.setTimeout(90_000)
  const { tap, pick, taps } = counter()
  await page.goto('/')
  await tap(page.getByRole('link', { name: 'Começar a mestrar' }))
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras de Ostria')
  // O sistema se escolhe já na criação.
  await tap(page.getByRole('radio', { name: 'D&D 5e (d20)' }))
  await tap(page.getByRole('button', { name: 'Criar campanha' }))
  await expect(page.getByRole('tablist', { name: 'Partes da Mesa' })).toBeVisible()
  await semRolagemDeLado(page, 'Mesa › Preparar')

  // Dois personagens de jogador. Criar abre a ficha; "Voltar para a lista" leva ao formulário de novo.
  await tap(page.getByRole('tab', { name: 'Grupo', exact: true }))
  for (const [nome, quem] of [
    ['Kaya', 'Ana'],
    ['Brenn', 'Davi'],
  ]) {
    await page.getByRole('textbox', { name: 'Nome do personagem' }).fill(nome)
    await page.getByRole('textbox', { name: 'Quem joga' }).fill(quem)
    await tap(page.getByRole('button', { name: 'Criar personagem' }))
    await semRolagemDeLado(page, `ficha de ${nome}`)
    await tap(page.getByRole('button', { name: 'Voltar para a lista' }))
  }
  await expect(page.getByRole('list').getByText('Kaya')).toBeVisible()
  await expect(page.getByRole('list').getByText('Brenn')).toBeVisible()

  // A sessão.
  await tap(page.getByRole('tab', { name: 'Preparar' }))
  await tap(page.getByRole('button', { name: 'Começar agora' }))
  await tap(page.getByRole('button', { name: 'Começar a jogar' }))
  await semRolagemDeLado(page, 'sessão em andamento')

  // Combate com 3 inimigos do bestiário.
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await tap(init.getByRole('button', { name: 'Combate!' }))
  await semRolagemDeLado(page, 'começo do combate')
  // O bestiário de uma campanha nova está vazio: o combate oferece trazer os inimigos comuns.
  const pronto = init.getByRole('combobox', { name: 'Inimigo pronto' })
  await pick(pronto, /Trazer inimigos comuns/)
  await expect(pronto.locator('option', { hasText: 'Goblin' })).toBeAttached()
  await expect(pronto.locator('option', { hasText: 'Trazer inimigos comuns' })).toHaveCount(0)
  await expect(pronto).toHaveValue(/.+/)
  await init.getByRole('textbox', { name: 'Quantos' }).fill('3')
  await tap(init.getByRole('button', { name: 'Pôr no combate' }))
  await expect(init.locator('.fight-row')).toHaveCount(3 + 2)
  for (const pc of ['Kaya', 'Brenn']) await tap(init.getByRole('button', { name: `Rolar por ${pc}` }))
  await tap(init.getByRole('button', { name: 'Definir turnos' }))
  await expect(init.getByText('Rodada 1')).toBeVisible()
  await semRolagemDeLado(page, 'combate em andamento')

  // A ordem sai dos dados: toca em "Próxima vez" até chegar a vez de um goblin, com o ataque já pronto.
  const vez = page.getByRole('region', { name: /^Vez de Goblin/ })
  for (let i = 0; i < 6 && !(await vez.count()); i++) await tap(init.getByRole('button', { name: /Próxima vez/ }))
  await expect(vez).toBeVisible()
  const atacante = (await vez.getAttribute('aria-label'))!.replace('Vez de ', '')
  await tap(vez.getByRole('button', { name: /^Atacar com Cimitarra/ }))
  // Em quem? Em outro goblin (a Defesa dele já vem do bestiário).
  await tap(page.getByRole('dialog').getByRole('button', { name: /^Goblin \d/ }).filter({ hasNotText: atacante }).first())
  // Dados na mesa: o mestre digita o que saiu no dado de verdade (ou toca em "Rolar no app").
  const dado = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await dado.getByRole('spinbutton').fill('15')
  await tap(dado.getByRole('button', { name: 'Registrar' }))
  // O resultado fica numa faixa embaixo, com o dano a um toque.
  const faixa = page.getByRole('complementary', { name: 'Últimas rolagens' })
  await expect(faixa).toContainText('Acerta')
  await tap(faixa.getByRole('button', { name: /^Rolar dano/ }))
  const dano = page.getByRole('dialog', { name: 'Quanto saiu no dado?' })
  await dano.getByRole('spinbutton').fill('4')
  await tap(dano.getByRole('button', { name: 'Registrar' }))
  await semRolagemDeLado(page, 'depois do dano')

  // Fim do combate e da sessão.
  await tap(init.getByRole('button', { name: 'Encerrar combate' }))
  await tap(page.getByRole('button', { name: 'Encerrar sessão', exact: true }))
  await tap(page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }))
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await expect(fim.getByRole('heading', { name: 'O que aconteceu?' })).toBeVisible()
  await semRolagemDeLado(page, 'fim da sessão')
  // Do "Começar a mestrar" até o fim da sessão, num celular: tudo em poucos toques.
  expect(taps(), 'toques da campanha ao fim da sessão').toBeLessThanOrEqual(30)
})

test('a barra da sessão cabe em 360 px, sem botão cortado', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByRole('link', { name: 'Começar a mestrar' }).click()
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras')
  await page.getByRole('button', { name: 'Criar campanha' }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  const barra = page.locator('.sm-acts')
  await expect(barra).toBeVisible()
  for (const botao of await barra.locator('> *').all()) {
    const caixa = (await botao.boundingBox())!
    expect(caixa.x + caixa.width, 'botão da barra da sessão passa da borda').toBeLessThanOrEqual(360)
  }
  // O menu "Mais da sessão" (dados, tema, …) está à mão.
  await page.getByRole('button', { name: 'Mais da sessão' }).click()
  await expect(page.locator('.sm-more')).toBeVisible()
})

test('o bestiário vazio oferece inimigos comuns, e eles entram no combate numerados', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Começar a mestrar' }).click()
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras')
  await page.getByRole('button', { name: 'Criar campanha' }).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Combate!' }).click()
  const pronto = init.getByRole('combobox', { name: 'Inimigo pronto' })
  await pronto.selectOption({ label: '+ Trazer inimigos comuns (Goblin, Lobo…)' })
  for (const nome of ['Goblin', 'Lobo', 'Esqueleto', 'Bandido', 'Ogro']) await expect(pronto.locator('option', { hasText: nome })).toBeAttached()
  await pronto.selectOption({ label: 'Lobo' })
  await init.getByRole('textbox', { name: 'Quantos' }).fill('2')
  await init.getByRole('button', { name: 'Pôr no combate' }).click()
  await expect(init.locator('.fight-row', { hasText: /^Lobo [12]/ }).or(init.locator('.fight-row', { hasText: 'Lobo' }))).toHaveCount(2)
})
