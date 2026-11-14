import { expect, test } from './fixtures.ts'
import { openPart } from './areas.ts'

const transform = (page: import('@playwright/test').Page) => page.locator('.graph > g').getAttribute('transform')

test('mover o mapa funciona mesmo quando o navegador dá largura 0 ao SVG (Safari, Firefox)', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, 'clientWidth', {
      get() {
        return this instanceof SVGElement ? 0 : this.getBoundingClientRect().width
      },
    }),
  )
  await page.goto('/app/')
  await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
  await openPart(page, 'Ligações')
  await page.locator('.node').first().waitFor()
  const box = (await page.locator('.graph').boundingBox())!
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 160, box.y + 120, { steps: 5 })
  await page.mouse.up()
  const t = await transform(page)
  expect(t).not.toMatch(/Infinity|NaN/)
  expect(t).toMatch(/^translate\(1\d\d/)
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true })

  test('um dedo move, dois dedos dão zoom, e a página não rola', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await openPart(page, 'Ligações')
    await page.locator('.node').first().waitFor()
    const box = (await page.locator('.graph').boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await touch('touchStart', [[cx, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx + i * 15, cy + i * 10]])
    await touch('touchEnd', [])
    const moved = await transform(page)
    expect(moved).not.toMatch(/Infinity|NaN/)
    expect(moved).toContain('scale(1)')
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]])
    await touch('touchEnd', [])
    expect(await transform(page)).toMatch(/scale\(2\.\d+\)/)
    expect(await page.evaluate(() => [scrollX, scrollY, document.querySelector('.stage')!.scrollTop])).toEqual([0, 0, 0])
  })

  test('arrastar começando numa bolinha move o mapa e não seleciona a bolinha; tocar seleciona', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
    await openPart(page, 'Ligações')
    const node = page.locator('.node').first()
    await node.waitFor()
    await page.waitForTimeout(1200)
    const nb = (await node.locator('circle').last().boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: [number, number][]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
    const [x, y] = [nb.x + nb.width / 2, nb.y + nb.height / 2]
    const before = await transform(page)
    await touch('touchStart', [[x, y]])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[x + i * 12, y + i * 8]])
    await touch('touchEnd', [])
    await expect.poll(() => transform(page)).not.toBe(before)
    // O desenho acompanhou o dedo até o fim (72 px para a direita), e não parou no primeiro passo: o aviso de que o
    // toque largou a bolinha de baixo (lostpointercapture) não pode encerrar o arrasto.
    const shift = (t: string | null) => Number(t?.match(/^translate\(([-\d.]+)/)?.[1])
    expect(shift(await transform(page)) - shift(before)).toBeGreaterThan(50)
    await expect(page.getByRole('complementary', { name: 'Ficha selecionada' })).toHaveCount(0)
    // Um toque de verdade (sem andar) numa bolinha à vista seleciona.
    await page.waitForTimeout(300)
    const g = (await page.locator('.graph').boundingBox())!
    const spot = await page.locator('.node > circle:last-of-type').evaluateAll(
      (cs, gb) => {
        for (const c of cs) {
          const r = c.getBoundingClientRect()
          const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2]
          if (cx > gb.x + 40 && cx < gb.x + gb.width - 40 && cy > gb.y + 40 && cy < gb.y + gb.height - 90) return [cx, cy]
        }
        return null
      },
      g,
    )
    expect(spot).not.toBeNull()
    await touch('touchStart', [spot as [number, number]])
    await touch('touchEnd', [])
    await expect(page.getByRole('complementary', { name: 'Ficha selecionada' })).toBeVisible()
  })
})

test('o cartão da ficha fecha: no X, no Esc e tocando no fundo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Ligações')
  const card = page.getByRole('complementary', { name: 'Ficha selecionada' })
  const node = page.locator('.node').first()
  await node.click()
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: 'Fechar o cartão' }).click()
  await expect(card).toHaveCount(0)

  await node.click()
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)

  await node.click()
  const box = (await page.locator('.graph').boundingBox())!
  await page.mouse.click(box.x + 8, box.y + 8)
  await expect(card).toHaveCount(0)
})

test('no celular, os nomes não se sobrepõem e dá para escolher um livro só', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo')
  await openPart(page, 'Ligações')
  const overlaps = () =>
    page.evaluate(() => {
      const rs = [...document.querySelectorAll('.graph .node text')].map((t) => t.getBoundingClientRect()).filter((r) => r.width > 0)
      let n = 0
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i]
          const b = rs[j]
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++
        }
      return n
    })
  await expect(page.locator('.graph .node').first()).toBeVisible()
  // Espera a animação das bolinhas assentar.
  await page.waitForTimeout(1500)
  expect(await overlaps()).toBe(0)
  const all = await page.locator('.graph .node').count()

  // O livro 3 (com ou sem "(trechos)" no nome), escolhido no Início; as Ligações seguem.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Início/ }).first().click()
  const livro = page.getByLabel('Livro', { exact: true })
  await livro.selectOption((await livro.locator('option', { hasText: /^Ozma de Oz/ }).first().getAttribute('value'))!)
  await openPart(page, 'Ligações')
  await expect.poll(() => page.locator('.graph .node').count()).toBeLessThan(all)
  await expect(page.locator('.graph .node', { hasText: 'Ozma' }).first()).toBeVisible()
  await page.waitForTimeout(1500)
  expect(await overlaps()).toBe(0)

  // O "cena a cena" anda só pelas cenas deste livro.
  await page.getByRole('button', { name: /Ver cena a cena/ }).click()
  await expect(page.locator('.graph-time-label')).toContainText('Ozma de Oz')
  // E dá para sair dele sem abrir os Filtros.
  await page.getByRole('button', { name: 'Sair do cena a cena' }).click()
  await expect(page.locator('.graph-time')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Ver cena a cena/ })).toBeVisible()
})

test('passar o mouse numa ficha destaca o grupo dela sem mexer no resto do desenho', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await openPart(page, 'Ligações')
  await page.locator('.graph .node').first().waitFor()
  // Espera as bolinhas assentarem (a animação de entrada mexe em todas).
  await page.waitForTimeout(1500)
  const total = await page.locator('.graph .node').count()
  expect(total).toBeGreaterThan(10)
  // Conta quantas bolinhas e linhas têm o atributo mexido enquanto o mouse passa por cima de uma ficha.
  await page.evaluate(() => {
    const w = window as unknown as { __mut: Set<Element> }
    w.__mut = new Set()
    new MutationObserver((list) => list.forEach((m) => w.__mut.add((m.target as Element).closest('.node, .edge') ?? m.target as Element))).observe(document.querySelector('.graph')!, { subtree: true, attributes: true, childList: true })
  })
  const box = (await page.locator('.graph .node').first().locator('circle').first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.graph.has-focus')).toHaveCount(1)
  const touched = await page.evaluate(() => (window as unknown as { __mut: Set<Element> }).__mut.size)
  // Só quem entra no destaque (a ficha e quem se liga a ela) é redesenhado; o apagado vem por CSS.
  expect(touched).toBeLessThan(total)
  const opacity = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).opacity)
  await expect.poll(() => opacity('.graph .node:not(.hl) > circle:not(.node-ring)')).toBe('0.18')
  expect(await opacity('.graph .node.hl > circle:not(.node-ring)')).toBe('1')
  // Ao tirar o mouse, tudo volta.
  await page.mouse.move(2, 2)
  await expect(page.locator('.graph.has-focus')).toHaveCount(0)
  await expect.poll(() => opacity('.graph .node > circle:not(.node-ring)')).toBe('1')
})

test('no celular, quase nenhuma linha passa por cima de um nome (Terra de Oz)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/?exemplo')
  await openPart(page, 'Ligações')
  await expect(page.locator('.graph .node').first()).toBeVisible()
  // Espera as bolinhas assentarem.
  await page.waitForTimeout(1800)
  const crossed = await page.evaluate(() => {
    // O segmento passa pela caixa? (Liang–Barsky, como em src/logic/graph.ts.)
    const hit = (a: { x: number; y: number }, b: { x: number; y: number }, box: { x: number; y: number; w: number; h: number }) => {
      let t0 = 0
      let t1 = 1
      const dx = b.x - a.x
      const dy = b.y - a.y
      for (const [p, q] of [[-dx, a.x - box.x], [dx, box.x + box.w - a.x], [-dy, a.y - box.y], [dy, box.y + box.h - a.y]]) {
        if (p === 0) {
          if (q < 0) return false
          continue
        }
        const t = q / p
        if (p < 0) {
          if (t > t1) return false
          if (t > t0) t0 = t
        } else {
          if (t < t0) return false
          if (t < t1) t1 = t
        }
      }
      return t0 <= t1
    }
    const lines = [...document.querySelectorAll<SVGPathElement>('.graph .edge:not(.off):not(.edge-via) path')].map((p) => {
      const m = p.getAttribute('d')!.match(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/)!
      const c = p.getScreenCTM()!
      const pt = (x: number, y: number) => ({ x: c.a * x + c.c * y + c.e, y: c.b * x + c.d * y + c.f })
      return [pt(+m[1], +m[2]), pt(+m[3], +m[4])] as const
    })
    const names = [...document.querySelectorAll('.graph .node-label')].map((t) => {
      const r = t.getBoundingClientRect()
      return { name: t.textContent, box: { x: r.x + 1, y: r.y + 1, w: r.width - 2, h: r.height - 2 } }
    })
    return { total: names.length, crossed: names.filter((l) => lines.some(([a, b]) => hit(a, b, l.box))).map((l) => l.name) }
  })
  expect(crossed.total).toBeGreaterThan(50)
  // Antes eram 22 nomes riscados por linhas; sobra, no máximo, um ou outro de quem tem muitas ligações.
  expect(crossed.crossed.length, `riscados: ${crossed.crossed.join(', ')}`).toBeLessThanOrEqual(3)
})

test.describe('achar uma ficha pela lupa, no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a lupa fica à vista, leva o desenho até a ficha escolhida e a deixa em destaque', async ({ page }) => {
    await page.goto('/app/?exemplo')
    await openPart(page, 'Ligações')
    await expect(page.locator('.graph .node').first()).toBeVisible()
    await page.waitForTimeout(1500)
    // A lupa está na tela, sem abrir os filtros.
    const lupa = page.getByRole('button', { name: 'Achar ficha' })
    await expect(lupa).toBeVisible()
    await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible()

    // Uma ficha fora da tela (o desenho é maior que o celular): a mais longe do meio.
    const far = await page.evaluate(() => {
      const g = document.querySelector('.graph')!.getBoundingClientRect()
      const cx = g.x + g.width / 2
      const cy = g.y + g.height / 2
      let best: { name: string; d: number; out: boolean } | null = null
      for (const n of document.querySelectorAll('.graph .node')) {
        const r = n.querySelector('circle')!.getBoundingClientRect()
        const x = r.x + r.width / 2
        const y = r.y + r.height / 2
        const d = Math.hypot(x - cx, y - cy)
        const out = x < g.x || x > g.right || y < g.y || y > g.bottom
        if (out && (!best || d > best.d)) best = { name: n.getAttribute('aria-label')!.split(',')[0], d, out }
      }
      return best
    })
    expect(far, 'esperava alguma ficha fora da tela no exemplo de Oz').not.toBeNull()

    await lupa.click()
    const campo = page.getByRole('combobox', { name: 'Achar uma ficha' })
    await expect(campo).toBeFocused()
    await campo.fill(far!.name)
    await page.getByRole('option', { name: new RegExp(`^${far!.name}`) }).first().click()

    // A busca fecha, o cartão da ficha abre e a ficha pulsa.
    await expect(page.locator('#graph-find')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Ficha selecionada' }).getByRole('heading', { name: far!.name })).toBeVisible()
    await expect(page.locator('.graph .node.found')).toHaveCount(1)
    await expect(page.locator('.graph.has-focus')).toHaveCount(1)
    // O desenho foi até ela: agora está dentro da tela, na parte de cima (o cartão abre embaixo).
    await page.waitForTimeout(900)
    const where = await page.evaluate((name) => {
      const g = document.querySelector('.graph')!.getBoundingClientRect()
      const node = [...document.querySelectorAll('.graph .node')].find((n) => n.getAttribute('aria-label')?.startsWith(`${name},`))!
      const r = node.querySelector('circle')!.getBoundingClientRect()
      return { dx: r.x + r.width / 2 - (g.x + g.width / 2), dy: (r.y + r.height / 2 - g.y) / g.height }
    }, far!.name)
    expect(Math.abs(where.dx)).toBeLessThan(40)
    expect(where.dy).toBeGreaterThan(0.1)
    expect(where.dy).toBeLessThan(0.45)
    // O pulso acaba sozinho.
    await expect(page.locator('.graph .node.found')).toHaveCount(0, { timeout: 5000 })
  })

  test('uma ficha que não está no mapa agora (tipo escondido) também é achada: o tipo volta e aparece ela e quem se liga a ela', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await openPart(page, 'Ligações')
    await expect(page.locator('.graph .node').first()).toBeVisible()
    // Esconde os personagens pelos filtros.
    await page.getByRole('button', { name: /^Filtros/ }).click()
    await page.locator('.filter-chips').getByRole('button', { name: /Personagens/ }).click()
    await page.getByRole('button', { name: /^Filtros/ }).click()
    await expect(page.locator('.graph .node.kind-personagem')).toHaveCount(0)

    await page.getByRole('button', { name: 'Achar ficha' }).click()
    await page.getByRole('combobox', { name: 'Achar uma ficha' }).fill('Cassian')
    await page.getByRole('option', { name: /^Cassian/ }).first().click()
    await expect(page.getByRole('complementary', { name: 'Ficha selecionada' }).getByRole('heading', { name: 'Cassian' })).toBeVisible()
    // O tipo voltou, e a ficha está no mapa, em destaque.
    await expect(page.locator('.graph .node.kind-personagem[aria-label^="Cassian,"]')).toHaveCount(1)
    await expect(page.locator('.graph .node.kind-personagem.selected')).toHaveCount(1)
  })

  test('Esc fecha a busca e o botão some no computador', async ({ page }) => {
    await page.goto('/app/?exemplo=ostria')
    await openPart(page, 'Ligações')
    await page.getByRole('button', { name: 'Achar ficha' }).click()
    await expect(page.locator('#graph-find')).toBeVisible()
    // O primeiro Esc fecha a lista de fichas; o segundo, a busca.
    await page.keyboard.press('Escape')
    await expect(page.locator('#graph-find')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#graph-find')).toHaveCount(0)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByRole('button', { name: 'Achar ficha' })).toBeHidden()
  })
})
