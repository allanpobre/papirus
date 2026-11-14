import { expect, test } from './fixtures.ts'

test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })

// Os toques usam `click()`: no Chromium de teste, um toque dentro de um iframe com `sandbox` (a wiki) não vira clique,
// o que não acontece num celular de verdade. O que se mede aqui é o tamanho dos alvos e o que cada clique faz.

const ESTILOS = [
  ['classico', 'Clássico'],
  ['moderno', 'Moderno'],
  ['pergaminho', 'Pergaminho'],
  ['noturno', 'Noturno'],
] as const

test('wiki no celular (360 e 390 px), nos quatro estilos: sem rolagem de lado, alvos de toque, busca, Índice e links internos dentro do iframe', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: 'Wiki', exact: true }).click()
  await page.locator('iframe.wiki-view-preview').waitFor()
  const hostUrl = page.url()

  for (const largura of [360, 390]) {
    await page.setViewportSize({ width: largura, height: 800 })
    for (const [id, nome] of ESTILOS) {
      await page.getByRole('radiogroup', { name: 'Estilo da wiki' }).getByRole('radio', { name: new RegExp(nome) }).click()
      const wiki = page.frameLocator('iframe.wiki-view-preview')
      await wiki.locator(`body.estilo-${id}`).waitFor()
      const rotulo = `${largura} px, ${nome}`

      // Sem nada passando da largura (em qualquer estado) e com a letra da busca em 16 px (o iOS não amplia a tela ao tocar).
      const medida = () =>
        wiki.locator('html').evaluate((root) => {
          const d = root.ownerDocument
          const w = root.clientWidth
          const passa = [...d.querySelectorAll('body *')].filter((e) => {
            const r = e.getBoundingClientRect()
            return r.width > 0 && r.right > w + 1
          }).length
          return { passa, rola: d.documentElement.scrollWidth > w }
        })
      expect(await medida(), `home, ${rotulo}`).toEqual({ passa: 0, rola: false })

      // Alvos de toque: a busca e o Índice têm 44 px de altura; o botão do início também.
      const caixa = async (sel: string) => (await wiki.locator(sel).boundingBox())!
      expect((await caixa('#busca')).height, rotulo).toBeGreaterThanOrEqual(43)
      expect((await caixa('#menu')).height, rotulo).toBeGreaterThanOrEqual(43)
      expect((await caixa('#busca')).width, `${rotulo}: a busca tem lugar para digitar`).toBeGreaterThan(130)
      expect(await wiki.locator('#busca').evaluate((i) => parseFloat(getComputedStyle(i).fontSize))).toBeGreaterThanOrEqual(16)

      // Índice: abre, os links são fáceis de tocar, e tocar numa ficha abre a ficha, fecha o Índice e não leva a página para fora.
      await wiki.locator('#menu').click()
      await expect(wiki.locator('nav#indice')).toBeVisible()
      expect(await medida(), `índice, ${rotulo}`).toEqual({ passa: 0, rola: false })
      const alvo = wiki.locator('nav#indice a', { hasText: /^Kael$/ })
      expect((await alvo.boundingBox())!.height, rotulo).toBeGreaterThanOrEqual(40)
      await alvo.click()
      await expect(wiki.locator('.page.on h2').first()).toHaveText('Kael')
      await expect(wiki.locator('nav#indice')).toBeHidden()
      expect(page.url(), `o endereço do app não muda (${rotulo})`).toBe(hostUrl)
      // O título não fica escondido embaixo da barra de cima.
      const topo = await wiki.locator('.page.on h2').first().evaluate((h) => h.getBoundingClientRect().top - h.ownerDocument.querySelector('.bar')!.getBoundingClientRect().bottom)
      expect(topo, rotulo).toBeGreaterThan(8)
      expect(await medida(), `ficha, ${rotulo}`).toEqual({ passa: 0, rola: false })

      // Um link dentro do texto ("Citado em") leva a outra ficha, ainda dentro do iframe.
      await wiki.locator('.page.on .cites a').first().click()
      await expect(wiki.locator('.page.on h2').first()).not.toHaveText('Kael')
      expect(page.url()).toBe(hostUrl)

      // Busca: digitar mostra os resultados; tocar num resultado abre a ficha.
      await wiki.locator('#busca').fill('ostria')
      await expect(wiki.locator('#resultados')).toBeVisible()
      expect(await wiki.locator('#resultados .card').count(), rotulo).toBeGreaterThan(0)
      expect(await medida(), `resultados, ${rotulo}`).toEqual({ passa: 0, rola: false })
      const resultado = wiki.locator('#resultados .card').first()
      const titulo = (await resultado.locator('strong').textContent())!
      await resultado.click()
      await expect(wiki.locator('.page.on h2').first()).toHaveText(titulo)
      expect(page.url()).toBe(hostUrl)
      // Ao abrir a ficha a busca esvazia.
      await expect(wiki.locator('#busca')).toHaveValue('')
      // Volta ao início para o próximo estilo.
      await wiki.locator('.bar .home').click()
      await expect(wiki.locator('#inicio')).toBeVisible()
    }
  }
})
