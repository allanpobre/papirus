import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * Jornada de quem mestra, no celular: cria a campanha, faz o mundo com a Semente, escolhe um sistema e cria 3
 * fichas de jogo, rola boatos no mundo, marca uma viagem no mapa, joga uma sessão, encerra e põe o ano no mundo.
 * Conta os toques por etapa (auditoria 16). O celular do jogador ao vivo tem a sua própria spec (jogador-celular).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

function counter() {
  let taps = 0
  const marks: Record<string, number> = {}
  return {
    tap: async (l: Locator) => {
      taps++
      await l.click()
    },
    mark: (etapa: string) => {
      marks[etapa] = taps
    },
    marks: () => marks,
  }
}

const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

test('o mestre vai da campanha ao fim da primeira sessão', async ({ page }) => {
  test.setTimeout(90_000)
  const { tap, mark, marks } = counter()

  // 1. Cria a campanha.
  await page.goto('/')
  await tap(page.getByRole('link', { name: 'Começar a mestrar' }))
  await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Brumas de Ostria')
  await tap(page.getByRole('button', { name: 'Criar campanha' }))
  await expect(page.getByRole('tablist', { name: 'Partes da Mesa' })).toBeVisible()
  mark('1 campanha')

  // 2. Faz o mundo com a Semente (pelo Início).
  await tap(page.getByRole('button', { name: 'Menu', exact: true }))
  await tap(page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /^Início/ }))
  await tap(page.getByRole('button', { name: 'Plantar a semente' }).first())
  const seed = page.getByRole('dialog', { name: 'Semente do mundo' })
  await tap(seed.getByRole('radio', { name: 'Um império' }))
  await seed.getByRole('textbox', { name: 'Nome da ameaça (opcional)' }).fill('A Névoa')
  await tap(seed.getByRole('button', { name: 'Plantar a semente' }))
  await expect(page.getByRole('heading', { name: 'O que falta no mundo' })).toBeVisible()
  mark('2 semente')

  // 3. Escolhe um sistema e cria 3 fichas de jogo.
  await tap(nav(page, 'Mesa'))
  await tap(page.getByRole('tab', { name: 'Preparar' }))
  // Sem escolher na criação, a campanha nasce no Narrativo; aqui se troca por um estilo D&D novo (1 toque na lista).
  await page.getByRole('combobox', { name: 'Sistema do grupo' }).selectOption({ label: '+ Novo: estilo D&D 5e' })
  await expect(page.getByRole('combobox', { name: 'Sistema do grupo' })).toContainText('Estilo D&D 5e')
  await tap(page.getByRole('tab', { name: 'Personagens', exact: true }))
  for (const [personagem, jogador] of [['Kaya', 'Ana'], ['Brenn', 'Bruno'], ['Lume', 'Carla']]) {
    await page.getByRole('textbox', { name: 'Nome do personagem' }).fill(personagem)
    await page.getByRole('textbox', { name: 'Quem joga' }).fill(jogador)
    await tap(page.getByRole('button', { name: 'Criar personagem' }))
    // A ficha nova abre em Jogar: um toque em "Voltar para a lista" leva de volta ao formulário.
    await expect(page.getByRole('heading', { name: personagem, level: 2 })).toBeVisible()
    await tap(page.getByRole('button', { name: 'Voltar para a lista' }))
  }
  mark('3 sistema e fichas de jogo')

  // 4. Rola um boato do mundo e o vira pista.
  await tap(nav(page, /^Mundo/))
  await tap(page.getByRole('button', { name: 'Rolar no mundo' }))
  const rolar = page.getByRole('dialog', { name: 'Rolar no mundo' })
  await tap(rolar.getByRole('radio', { name: /^Bo/ }))
  await tap(rolar.getByRole('button', { name: /^Rolar:/ }))
  await expect(rolar.getByRole('button', { name: 'Virar pista' })).toBeVisible()
  await tap(rolar.getByRole('button', { name: 'Virar pista' }))
  await page.keyboard.press('Escape')
  mark('4 boato rolado')

  // 5. Marca uma viagem no mapa: dois lugares e uma rota entre eles, com os dias de viagem.
  await tap(page.locator('[data-tour="partes"]').getByRole('button', { name: 'Mapas' }))
  await tap(page.getByRole('button', { name: 'Gerar', exact: true }))
  const mapa = page.locator('.atlas-image').first()
  const box = (await mapa.boundingBox())!
  for (const [nome, fx] of [['Porto Azul', 0.3], ['Monte Sol', 0.7]] as const) {
    await tap(page.getByRole('button', { name: 'Marcar lugar' }))
    await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * 0.5)
    await page.getByPlaceholder('Lugar…').fill(nome)
    await page.getByPlaceholder('Lugar…').press('Enter')
    await expect(page.locator('.pin')).toHaveCount(fx < 0.5 ? 1 : 2)
  }
  await tap(page.getByRole('button', { name: 'Rota', exact: true }))
  const pins = page.locator('.pin')
  for (const i of [0, 1]) {
    const b = (await pins.nth(i).boundingBox())!
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  }
  await expect(page.getByText(/dias a pé/)).toBeVisible()
  mark('5 viagem no mapa')

  // 6. Joga a sessão 1 (o celular do jogador ao vivo é testado em jogador-celular.spec).
  await tap(nav(page, 'Mesa'))
  await tap(page.getByRole('tab', { name: 'Preparar' }))
  await tap(page.getByRole('button', { name: 'Começar agora' }))
  await tap(page.getByRole('button', { name: 'Começar a jogar' }))
  await expect(page.getByRole('button', { name: 'Encerrar sessão', exact: true })).toBeVisible()
  mark('6 sessão aberta')

  // 7. Encerra e põe o ano no mundo.
  await tap(page.getByRole('button', { name: 'Encerrar sessão', exact: true }))
  await tap(page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }))
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await fim.getByRole('textbox', { name: /O que aconteceu|Resumo da sessão/ }).fill('Kaya, Brenn e Lume chegaram a Porto Azul.')
  await fim.getByRole('spinbutton', { name: /Ano no mundo/ }).or(fim.getByLabel('Ano no mundo')).first().fill('359')
  await tap(fim.getByRole('button', { name: 'Fechar' }))
  mark('7 sessão encerrada')

  expect(marks()['7 sessão encerrada'], 'toques da jornada inteira').toBeLessThanOrEqual(60)
  console.log('TOQUES ACUMULADOS POR ETAPA', JSON.stringify(marks()))
})

