import { openPart } from './areas.ts'
import { expect, test, type Page } from './fixtures.ts'

/*
 * Recortar a imagem antes de guardar: o retrato é quadrado (arrasta e dá zoom), o mapa é livre (arrasta o retângulo e as
 * bordas). A foto de teste é horizontal (800 × 400): metade esquerda vermelha, metade direita azul; assim dá para ver, na
 * imagem guardada, qual parte foi mantida.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** Um PNG horizontal, vermelho à esquerda e azul à direita, gerado no navegador. */
async function foto(page: Page, w = 800, h = 400) {
  const data = await page.evaluate(
    ([w, h]) => {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      const g = cv.getContext('2d')!
      g.fillStyle = '#d02020'
      g.fillRect(0, 0, w / 2, h)
      g.fillStyle = '#2040d0'
      g.fillRect(w / 2, 0, w / 2, h)
      return cv.toDataURL('image/png')
    },
    [w, h] as const,
  )
  return { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(data.split(',')[1], 'base64') }
}

/** A cor do meio da imagem guardada (vermelho = parte da esquerda, azul = parte da direita) e as medidas dela. */
async function guardada(page: Page, nome: string) {
  return page.getByRole('img', { name: `Imagem de ${nome}` }).evaluate((img: HTMLImageElement) => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const px = (x: number) => [...g.getImageData(Math.floor(x), Math.floor(c.height / 2), 1, 1).data].slice(0, 3)
    return { w: img.naturalWidth, h: img.naturalHeight, esquerda: px(c.width * 0.08), direita: px(c.width * 0.92) }
  })
}

async function fichaNova(page: Page, nome: string) {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Ilhas')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).click()
  // No celular, a ficha nova nasce pelo botão redondo "+".
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  const nova = page.getByRole('dialog', { name: 'Nova ficha' })
  await nova.getByRole('textbox', { name: 'Nome' }).fill(nome)
  await nova.getByRole('button', { name: 'Criar e abrir' }).click()
}

const vermelho = (c: number[]) => c[0] > 150 && c[2] < 100
const azul = (c: number[]) => c[2] > 150 && c[0] < 100

test('retrato: o recorte é quadrado; arrastar com o dedo escolhe a parte que fica', async ({ page }) => {
  await fichaNova(page, 'Mira')
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await foto(page))
  const janela = page.getByRole('dialog', { name: 'Enquadrar o retrato' })
  await expect(janela).toBeVisible()
  const area = janela.getByRole('img', { name: /Área do retrato/ })
  await expect(area).toBeVisible()
  // O quadrado aparece com lado de verdade e a janela cabe na tela.
  const caixa = (await area.boundingBox())!
  expect(caixa.width).toBeCloseTo(caixa.height, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)

  // Arrasta a imagem para a direita (o dedo anda para a direita: aparece a parte da ESQUERDA, a vermelha).
  const cdp = await page.context().newCDPSession(page)
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  const cx = caixa.x + caixa.width / 2
  const cy = caixa.y + caixa.height / 2
  await toque('touchStart', [[cx - 60, cy]])
  for (let i = 1; i <= 8; i++) await toque('touchMove', [[cx - 60 + i * 40, cy]])
  await toque('touchEnd', [])
  await janela.getByRole('button', { name: 'Usar este recorte' }).click()
  await expect(janela).toHaveCount(0)

  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  const r = await guardada(page, 'Mira')
  // Quadrado, encolhido (o lado menor da foto era 400) e com a parte da esquerda (vermelha).
  expect(r.w).toBe(r.h)
  expect(r.w).toBeLessThanOrEqual(400)
  expect(vermelho(r.esquerda), 'a esquerda do retrato é vermelha').toBe(true)
  expect(vermelho(r.direita), 'a direita do retrato também é vermelha (só a metade esquerda ficou)').toBe(true)
})

test('retrato: zoom pelo controle aproxima o enquadramento, e "Sem recortar" guarda a imagem inteira', async ({ page }) => {
  await fichaNova(page, 'Brenn')
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await foto(page))
  const janela = page.getByRole('dialog', { name: 'Enquadrar o retrato' })
  // Zoom máximo no centro: o recorte pega o encontro do vermelho e do azul, e fica pequeno.
  await janela.getByRole('slider', { name: 'Zoom do retrato' }).fill('4')
  await janela.getByRole('button', { name: 'Usar este recorte' }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  const perto = await guardada(page, 'Brenn')
  expect(perto.w).toBe(perto.h)
  expect(vermelho(perto.esquerda), 'no zoom, a esquerda do recorte é a parte vermelha do meio').toBe(true)
  expect(azul(perto.direita), 'e a direita é a azul').toBe(true)

  // Trocar pela mesma foto, sem recortar: sai a imagem inteira (horizontal).
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await foto(page))
  await page.getByRole('dialog', { name: 'Enquadrar o retrato' }).getByRole('button', { name: 'Sem recortar' }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Ler' }).click()
  const inteira = await guardada(page, 'Brenn')
  expect(inteira.w).toBe(2 * inteira.h)
  expect(vermelho(inteira.esquerda) && azul(inteira.direita)).toBe(true)
})

test('cancelar o recorte não guarda nada', async ({ page }) => {
  await fichaNova(page, 'Kaya')
  await page.locator('.portrait-edit input[type=file]').setInputFiles(await foto(page))
  await page.getByRole('dialog', { name: 'Enquadrar o retrato' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog', { name: 'Enquadrar o retrato' })).toHaveCount(0)
  await expect(page.locator('.entity-row-pic')).toHaveCount(0)
})

test('mapa: o recorte é livre; arrastar uma borda deixa só o lado de que se precisa', async ({ page }) => {
  await fichaNova(page, 'Qualquer')
  await openPart(page, 'Mapas')
  await page.locator('.atlas-view input[type=file]').setInputFiles(await foto(page))
  const janela = page.getByRole('dialog', { name: 'Recortar o mapa' })
  await expect(janela).toBeVisible()
  const caixa = janela.getByRole('group', { name: /Área do recorte/ })
  const imagem = (await janela.locator('.crop-free').boundingBox())!
  const antes = (await caixa.boundingBox())!
  expect(antes.width).toBeCloseTo(imagem.width, 0)
  // A borda da direita para o meio: o recorte fica só com a metade da esquerda (a vermelha).
  const borda = janela.getByRole('button', { name: 'Arrastar a borda da direita' })
  const b = (await borda.boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  const x0 = b.x + b.width / 2
  const y0 = b.y + b.height / 2
  await toque('touchStart', [[x0, y0]])
  const alvo = imagem.x + imagem.width / 2
  for (let i = 1; i <= 8; i++) await toque('touchMove', [[x0 + ((alvo - x0) * i) / 8, y0]])
  await toque('touchEnd', [])
  const depois = (await caixa.boundingBox())!
  expect(depois.width).toBeLessThan(antes.width * 0.6)
  expect(depois.width).toBeGreaterThan(antes.width * 0.4)
  await janela.getByRole('button', { name: 'Usar este recorte' }).click()
  await expect(janela).toHaveCount(0)
  // O mapa guardado é a metade vermelha: 400 × 400 (ou menos) e sem azul.
  const img = page.locator('.atlas-image')
  await expect(img).toHaveAttribute('style', /blob:/)
  const medidas = await page.evaluate(async () => {
    const url = (document.querySelector('.atlas-image') as HTMLElement).style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '')
    const i = new Image()
    i.src = url
    await i.decode()
    const c = document.createElement('canvas')
    c.width = i.naturalWidth
    c.height = i.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(i, 0, 0)
    const px = (x: number) => [...g.getImageData(Math.floor(x), Math.floor(c.height / 2), 1, 1).data].slice(0, 3)
    return { w: i.naturalWidth, h: i.naturalHeight, direita: px(c.width * 0.95) }
  })
  expect(medidas.h).toBe(400)
  expect(medidas.w).toBeGreaterThan(380)
  expect(medidas.w).toBeLessThan(420)
  expect(vermelho(medidas.direita), 'a direita do mapa guardado ainda é vermelha: o azul foi cortado').toBe(true)
})
