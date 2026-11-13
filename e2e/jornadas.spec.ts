import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * As jornadas de quem chega, do primeiro clique em diante, contando os toques. Sem pular o tour
 * nem mexer nos dados: como quem acabou de receber o link.
 */

function counter() {
  let taps = 0
  return {
    tap: async (l: Locator) => {
      taps++
      await l.click()
    },
    taps: () => taps,
  }
}

const firstSteps = (page: Page) => page.getByRole('region', { name: 'Primeiros passos' })

test.describe('escritora no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('da apresentação à primeira ficha, sem janela no caminho e com os nomes à vista', async ({ page }) => {
    const { tap, taps } = counter()
    await page.goto('/')
    await tap(page.getByRole('link', { name: 'Começar a escrever' }).first())
    await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Baixa')
    await tap(page.getByRole('button', { name: 'Criar universo' }))

    // Nenhuma janela de tour: o Início mostra os primeiros passos.
    await page.waitForTimeout(1000)
    await expect(page.locator('.tour')).toHaveCount(0)
    await expect(firstSteps(page).getByRole('listitem')).toHaveCount(3)
    await tap(firstSteps(page).getByRole('button', { name: 'Escreva a primeira cena' }))

    // A Página: enquanto se escreve, os nomes aparecem na barra acima do teclado (e no rodapé, com o teclado fechado).
    const editor = page.getByRole('textbox', { name: 'Texto da cena' })
    await editor.click()
    await page.keyboard.type('Era noite em Ostria quando Kaya desceu do navio. O capitão Brenn esperava no cais.')
    const nomes = page.getByRole('toolbar', { name: 'Formatação' }).getByRole('button', { name: '3 nomes novos' })
    await expect(nomes).toBeVisible()
    await tap(nomes)
    const revisao = page.getByRole('dialog', { name: 'Revisão' })
    const kaya = revisao.locator('.candidate').filter({ has: page.locator('.candidate-name', { hasText: /^Kaya$/ }) })
    await tap(kaya.getByRole('button', { name: 'Criar ficha' }))
    await expect(page.getByText('Ficha “Kaya” criada')).toBeVisible()
    expect(taps(), 'toques até a primeira ficha').toBeLessThanOrEqual(5)

    // De volta ao Início (fechado o teclado, a barra de baixo volta), dois dos passos estão riscados.
    await page.keyboard.press('Escape')
    await expect(revisao).toHaveCount(0)
    // Fechada a Revisão, o foco volta ao texto um instante depois (o teclado "abre" de novo e a barra
    // de baixo some), às vezes depois de a barra já ter voltado: repete "fechar o teclado e tocar em
    // Início" até o toque pegar, em vez de olhar uma vez só.
    const fecharTeclado = page.getByRole('button', { name: 'Fechar o teclado' })
    const inicio = page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Início', exact: true })
    await expect(async () => {
      if (await fecharTeclado.isVisible()) await fecharTeclado.click()
      await inicio.click({ timeout: 1000 })
    }).toPass({ timeout: 15000 })
    await expect(firstSteps(page).locator('li.is-done')).toHaveCount(2)
    await expect(firstSteps(page).getByRole('button', { name: 'Deixe um bilhete para amanhã' })).toBeVisible()
  })
})

test('mestre no computador: da apresentação à sessão 1 encerrada, pelos primeiros passos', async ({ page }) => {
  test.setTimeout(60_000)
  const { tap, taps } = counter()
  await page.goto('/')
  await tap(page.getByRole('link', { name: 'Começar a mestrar' }))
  // Já na aba Mesa de Seus universos.
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras de Ostria')
  await tap(page.getByRole('button', { name: 'Criar campanha' }))

  // Sem tour por cima; a campanha abre na Mesa. Os primeiros passos ficam no Início.
  await page.waitForTimeout(1000)
  await expect(page.locator('.tour')).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Partes da Mesa' })).toBeVisible()
  await tap(page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Início/ }))
  await tap(firstSteps(page).getByRole('button', { name: 'Crie o personagem de cada jogador' }))
  await expect(page.getByRole('tab', { name: 'Grupo', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('textbox', { name: 'Nome do personagem' }).fill('Kaya')
  await page.getByRole('textbox', { name: 'Quem joga' }).fill('Ana')
  await tap(page.getByRole('button', { name: 'Criar personagem' }))

  // A sessão 1: começa e termina com "O que aconteceu?".
  await tap(page.getByRole('tab', { name: 'Preparar' }))
  await tap(page.getByRole('button', { name: 'Começar agora' }))
  await tap(page.getByRole('button', { name: 'Começar a jogar' }))
  await tap(page.getByRole('button', { name: 'Encerrar sessão', exact: true }))
  await tap(page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }))
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await expect(fim.getByRole('heading', { name: 'O que aconteceu?' })).toBeVisible()
  expect(taps(), 'toques até encerrar a sessão 1').toBeLessThanOrEqual(11)
  await fim.getByRole('button', { name: 'Fechar' }).click()

  // A Kaya está no Mundo (um personagem só), e dois dos três passos estão feitos.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  await expect(page.locator('.entity-row-name', { hasText: /^Kaya$/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Início/ }).click()
  await expect(firstSteps(page).locator('li.is-done')).toHaveCount(2)
  await expect(firstSteps(page).getByRole('button', { name: 'Convide o grupo' })).toBeVisible()
})
