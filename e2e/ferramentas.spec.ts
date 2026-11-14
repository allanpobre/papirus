import { expect, test } from './fixtures.ts'

test.describe('achar as funções, no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('o "Mais" leva a Todas as ferramentas, e um toque abre a área', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await page.getByRole('button', { name: 'Mais', exact: true }).click()
    // Os grupos do "Mais" dizem o que cada área é.
    const mais = page.getByRole('group', { name: 'Todas as áreas' })
    for (const g of ['Escrever', 'Mundo e Trama', 'Mesa de RPG', 'Ferramentas']) await expect(mais.getByRole('group', { name: g })).toBeVisible()
    await mais.getByRole('button', { name: /Todas as ferramentas/ }).click()

    // Ajustes já na lista: cada área com uma frase.
    const lista = page.getByRole('region', { name: 'Todas as ferramentas' })
    await expect(lista).toBeVisible()
    await expect(lista.getByRole('button', { name: /Ligações/ })).toContainText('desenho de quem se liga a quem')
    await expect(lista.getByRole('button', { name: /Quem sabe o quê/ })).toBeVisible()
    await lista.getByRole('button', { name: /Linha do tempo/ }).click()
    await expect(page.getByRole('tab', { name: /Linha do tempo|Tempo/ }).or(page.locator('[data-tour="partes"]')).first()).toBeVisible()
  })

  test('Simples ou Completo vem com um exemplo do que muda na ficha', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await page.getByRole('button', { name: 'Mais', exact: true }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /Ajustes e dados/ }).click()
    await page.getByRole('button', { name: /^Universo/ }).click()
    const exemplo = page.getByLabel('O que muda na ficha de um personagem')
    await expect(exemplo).toContainText('Simples mostra')
    await expect(exemplo).toContainText('Completo acrescenta')
    await expect(exemplo).toContainText('Quão pronta')
    // No modo Simples, a Trama sai do menu e a lista avisa por quê.
    await page.getByRole('radio', { name: 'Simples' }).click()
    await page.getByRole('button', { name: /^Mais/ }).click()
    await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /Todas as ferramentas/ }).click()
    const trama = page.getByRole('region', { name: 'Todas as ferramentas' }).getByRole('button', { name: /^Trama/ })
    await expect(trama).toContainText('modo Simples')
  })
})
