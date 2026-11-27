import { expect, test, type Page } from './fixtures.ts'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** Quanto, no máximo, cada gesto pode levar com a CPU 4× mais lenta (no servidor de desenvolvimento, que é bem mais lento que o app de verdade). */
const ORCAMENTO_MS = 3000

/** Um combate de 15 (3 jogadores e 12 goblins) no celular, com os turnos já definidos. */
async function combateDeQuinze(page: Page) {
  await page.goto('/app/')
  await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mesa', exact: true }).click()
  await page.getByRole('tab', { name: 'Preparar' }).click()
  await page.getByRole('tab', { name: 'Sessões' }).click()
  await page.getByRole('button', { name: 'Começar', exact: true }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  const init = page.getByRole('region', { name: 'Iniciativa' })
  await init.getByRole('button', { name: 'Combate!' }).click()
  const pronto = init.getByRole('combobox', { name: 'Inimigo pronto' })
  await pronto.selectOption({ label: '+ Trazer inimigos comuns (Goblin, Lobo…)' })
  await pronto.selectOption({ label: 'Goblin' })
  await init.getByRole('textbox', { name: 'Quantos' }).fill('12')
  await init.getByRole('button', { name: 'Pôr no combate' }).click()
  // Quem ainda não rolou rola (o mestre conduz).
  for (let i = 0; i < 20; i++) {
    const rolar = init.getByRole('button', { name: /^Rolar por /, exact: false }).first()
    if (!(await rolar.count())) break
    await rolar.click()
  }
  await init.getByRole('button', { name: 'Definir turnos' }).click()
  await expect(page.locator('.fight-row')).toHaveCount(15)
  return init
}

/** Mede o que um gesto leva até a tela mostrar o resultado, com a CPU mais lenta. */
const medir = async (rotulo: string, fn: () => Promise<void>, medidas: Map<string, number>) => {
  const t0 = Date.now()
  await fn()
  medidas.set(rotulo, Date.now() - t0)
}

test('combate de 15 no celular com a CPU 4× mais lenta: passar o turno, dano, desfazer e condições com duração', async ({ page }) => {
  test.setTimeout(180_000)
  await combateDeQuinze(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const tempos = new Map<string, number>()
  const proxima = page.getByRole('button', { name: /^Próxima vez/ })
  const pill = page.locator('.round-pill')
  await expect(pill).toHaveText('Rodada 1')
  const primeiro = await page.locator('.fight-row.current .init-name-text').textContent()

  // Passar o turno: a vez muda a cada toque.
  const vistos = new Set<string>([primeiro!])
  for (let i = 0; i < 3; i++) {
    const antes = await page.locator('.fight-row.current .init-name-text').textContent()
    await medir(`próxima vez ${i + 1}`, async () => {
      await proxima.click()
      await expect(page.locator('.fight-row.current .init-name-text')).not.toHaveText(antes!)
    }, tempos)
    vistos.add((await page.locator('.fight-row.current .init-name-text').textContent())!)
  }
  expect(vistos.size).toBe(4)

  // Aplicar dano: o ataque de quem está na vez (rápido, ou o do goblin) num goblin que não seja ele, depois "Tirar N PV" da
  // bandeja de rolagens; e desfazer.
  await page.locator('.fight-more summary', { hasText: 'Vida, Defesa e condições' }).click()
  const quem = (await page.locator('.fight-row.current .init-name-text').textContent())!
  const alvo = quem === 'Goblin 12' ? 'Goblin 11' : 'Goblin 12'
  await medir('dano', async () => {
    const rapido = page.getByRole('textbox', { name: 'Dano do ataque' })
    if (await rapido.count()) {
      await rapido.fill('3')
      await page.locator('.turn-panel').getByRole('button', { name: 'Dano', exact: true }).click()
    } else await page.locator('.turn-panel .turn-attack').first().click()
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${alvo}\\b`) }).click()
    // A mesa usa dado de verdade: "Rolar no app" faz a rolagem aqui mesmo.
    await page.getByRole('button', { name: 'Rolar no app' }).click()
    await page.getByRole('button', { name: new RegExp(`^Tirar \\d+ PV de ${alvo}$`) }).click()
    await expect(page.locator('.fight-row', { hasText: alvo })).not.toContainText('PV 7/7')
  }, tempos)
  await medir('desfazer', async () => {
    await page.getByRole('button', { name: `Desfazer o dano em ${alvo}` }).click()
    await expect(page.locator('.fight-row', { hasText: alvo })).toContainText('PV 7/7')
  }, tempos)

  // Condição com duração: escolher e dizer por quanto tempo; some sozinha quando a rodada vira.
  await page.locator('.fight-row', { hasText: 'Goblin 3' }).locator('.fight-line').click()
  const cond = page.getByRole('combobox', { name: /^Adicionar condição a Goblin 3/ })
  const nomeCond = (await cond.locator('option').allInnerTexts())[1]
  await medir('condição', async () => {
    await cond.selectOption({ index: 1 })
    await page.getByRole('combobox', { name: /^Quanto tempo dura/ }).selectOption({ label: '1 rodada' })
    await expect(page.getByRole('button', { name: new RegExp(`^Tirar ${nomeCond} de Goblin 3`) })).toContainText('última rodada')
  }, tempos)

  // O resto da rodada: a volta se fecha (a rodada 2 começa e a condição acaba). Vale o tempo médio de cada toque.
  let toques = 0
  const t0 = Date.now()
  for (let i = 0; i < 15 && (await pill.textContent()) === 'Rodada 1'; i++) {
    await proxima.click()
    toques++
  }
  await expect(pill).toHaveText('Rodada 2')
  tempos.set('cada próxima vez (média)', Math.round((Date.now() - t0) / toques))
  await expect(page.getByRole('button', { name: new RegExp(`^Tirar ${nomeCond} de Goblin 3`) })).toHaveCount(0)

  // Nenhum gesto passou do orçamento (o que trava de verdade passa por muito).
  for (const [rotulo, ms] of tempos) expect(ms, `${rotulo} levou ${ms} ms`).toBeLessThan(ORCAMENTO_MS)
  console.log('tempos com CPU 4× (ms):', JSON.stringify(Object.fromEntries(tempos)))
})

test('o mesmo combate de 15 recarregado: a rodada, a vez e as condições continuam', async ({ page }) => {
  test.setTimeout(120_000)
  await combateDeQuinze(page)
  const proxima = page.getByRole('button', { name: /^Próxima vez/ })
  for (let i = 0; i < 4; i++) await proxima.click()
  const vez = await page.locator('.fight-row.current .init-name-text').textContent()
  await page.reload()
  await expect(page.locator('.session-mode-view')).toBeVisible()
  await expect(page.locator('.fight-row')).toHaveCount(15)
  await expect(page.locator('.round-pill')).toHaveText('Rodada 1')
  await expect(page.locator('.fight-row.current .init-name-text')).toHaveText(vez!)
})
