import { expect, test } from './fixtures.ts'

test('a apresentação leva ao app e ao exemplo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seu mundo, escrito e jogado no mesmo caderno.')
  await expect(page.getByRole('heading', { name: 'O mesmo mundo, agora na mesa.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Ver um mundo de exemplo' }).click()
  await expect(page).toHaveURL(/\/app\/$/)
  // O exemplo abre direto, no Início do universo.
  await expect(page.getByRole('heading', { name: 'Exemplo — O Alienista' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar escrevendo' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar escrevendo' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toContainText('Itaguaí')

  // Voltando à apresentação, quem já usa vê "Continuar".
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Continuar no Papirus/ }).first()).toBeVisible()
})

test('links antigos de jogadores e retornos de login vão para o app', async ({ page }) => {
  await page.goto('/?mesa=6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f')
  await expect(page).toHaveURL(/\/app\/\?mesa=6f1c2d3e/)
  await page.goto('/#error_description=teste&error=x')
  await expect(page).toHaveURL(/\/app\/#error_description=teste/)
})

test('a apresentação mostra os três setores, a mesa nova e o gerador da Oficina', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cada parte com a sua cara. O mesmo caderno por trás.' })).toBeAttached()
  for (const name of ['Escrita', 'Mesa de RPG', 'Oficina']) await expect(page.locator('.lp-sector-name', { hasText: name })).toBeAttached()
  await expect(page.getByRole('list', { name: 'Temas da mesa' }).getByRole('listitem')).toHaveCount(6)

  const ideia = page.getByRole('figure', { name: 'Gerador de ideias da Oficina' })
  await ideia.scrollIntoViewIfNeeded()
  await ideia.getByRole('radio', { name: 'Mesa' }).click()
  await expect(ideia.getByText('Quem pede')).toBeVisible()
  await ideia.getByRole('button', { name: 'Sortear outra' }).click()
  await expect(ideia.getByText('A complicação')).toBeVisible()
  // As barras do celular seguem a cor da página.
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#[0-9a-f]{6}$/)
})

test('a apresentação mostra a mesa dos dois lados e as telas de cada setor', async ({ page }) => {
  await page.goto('/')
  const trio = page.getByRole('figure', { name: /o mestre com o escudo no tablet e dois jogadores com o cartão no celular/ })
  await trio.scrollIntoViewIfNeeded()
  // A vez da Kaya chega no meio da tela; ela rola; o mestre confere e tira o dano; ela termina, a vez vai ao Taren e a revelação chega aos dois (uns 15 segundos).
  await expect(trio.locator('.lp-turn-now').getByText('Sua vez, Kaya!')).toBeVisible({ timeout: 6_000 })
  await expect(trio.locator('.lp-tray').getByText('Kaya · Espada longa contra Goblin')).toBeVisible({ timeout: 8_000 })
  await expect(trio.getByText('Goblin derrotado')).toBeVisible({ timeout: 10_000 })
  await expect(trio.getByText('Sua vez, Taren!').first()).toBeVisible({ timeout: 6_000 })
  await expect(trio.getByText('Revelado', { exact: true })).toBeVisible({ timeout: 8_000 })
  await expect(trio.getByText('O mestre revelou: a Ordem do Corvo')).toHaveCount(2)

  // Os passos da escrita e os amigos também têm a sua telinha.
  await expect(page.locator('.lp-steps .lp-mini')).toHaveCount(3)
  await expect(page.getByRole('figure', { name: /novidades dos amigos/ })).toBeVisible()

  // Por dentro: cada setor com as suas telas.
  const setores = page.getByRole('group', { name: 'Setor' })
  await expect(setores.getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('tablist', { name: 'Telas: Escrita' }).getByRole('tab')).toHaveText(['Mapa', 'Página e Revisão', 'Ficha do mundo', 'Treino', 'Placar'])
  await setores.getByRole('button', { name: 'Mesa de RPG' }).click()
  const mesa = page.getByRole('tablist', { name: 'Telas: Mesa de RPG' })
  await expect(mesa.getByRole('tab')).toHaveText(['Escudo do mestre', 'Combate', 'Ficha de jogo'])
  await mesa.getByRole('tab', { name: 'Combate' }).click()
  await expect(page.getByRole('tabpanel')).toBeVisible()
  await expect(page.locator('.lp-show-note')).toContainText('três jeitos de iniciativa: clássica, por lados ou pipoca')
  // Escolher uma tela para de girar sozinho.
  await page.waitForTimeout(8500)
  await expect(mesa.getByRole('tab', { name: 'Combate' })).toHaveAttribute('aria-selected', 'true')
})
