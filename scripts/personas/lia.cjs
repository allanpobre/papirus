const { chromium, devices } = require('playwright')
const BASE = process.env.BASE ?? 'http://localhost:5179'
const OUT = process.env.OUT ?? 'personas-saida'
const log = (...a) => console.log(...a)
;(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  const c = await b.newContext({ ...devices['iPhone 13'] })
  const p = await c.newPage()
  let taps = 0
  const tap = async (l) => { taps++; await l.click({ timeout: 8000 }) }
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` })
  const step = async (n, f) => { try { await f(); log('ok', n) } catch (e) { log('FALHOU', n, e.message.split('\n')[0]); await shot('erro-' + n.replace(/\W+/g, '-')) } }
  await p.goto(BASE + '/')
  await step('apresentação → Começar a escrever', () => tap(p.getByRole('link', { name: 'Começar a escrever' }).first()))
  await step('nome do universo', async () => { await p.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Coroa de Sal'); await tap(p.getByRole('button', { name: 'Criar universo' })) })
  await p.waitForTimeout(1200); await shot('lia-1-inicio')
  log('tour/janela aberta?', await p.locator('[role=dialog]').count())
  await step('ir escrever', async () => { const b1 = p.getByRole('button', { name: /Começar a escrever|Continuar escrevendo|Escrever a primeira cena/ }).first(); await tap(b1) })
  await step('digitar', async () => { await p.getByRole('textbox', { name: 'Texto da cena' }).click(); await p.keyboard.type('Ilsa olhou o porto. Ilsa sabia que Doran mentia. Doran sorriu para Ilsa no cais de Vaelor.') })
  await p.waitForTimeout(1500); await shot('lia-2-escrevendo')
  log('taps até escrever:', taps)
  log('aviso Salvo visível?', await p.getByText(/Salvo/).first().isVisible().catch(() => false))
  // Nome novo vira ficha pela seleção
  await step('selecionar Doran', async () => {
    await p.evaluate(() => { const ed = document.querySelector('[contenteditable=true]'); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.textContent.indexOf('Doran'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); break } } document.dispatchEvent(new Event('selectionchange')) })
    await p.waitForTimeout(500)
    const bolha = p.getByRole('toolbar', { name: 'Ações da seleção' })
    await tap(bolha.getByRole('button', { name: 'Ficha' }))
  })
  await p.waitForTimeout(1000); await shot('lia-3-ficha')
  log('depois da Ficha: dialogs', await p.locator('[role=dialog]').evaluateAll((d) => d.map((x) => x.getAttribute('aria-label'))))
  await p.keyboard.press('Escape')
  // Revisão
  await step('Revisão', () => tap(p.getByRole('button', { name: /^Revis/ }).first()))
  await p.waitForTimeout(800); await shot('lia-4-revisao')
  // Linha do tempo pela História
  await step('História', () => tap(p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'História' })))
  await p.waitForTimeout(800); await shot('lia-5-historia')
  log('partes da História:', await p.locator('[data-tour="partes"] button').allInnerTexts())
  // Início pelo Menu
  await step('Início pelo Menu', async () => { await tap(p.getByRole('button', { name: 'Menu', exact: true })); await shot('lia-6-menu'); await tap(p.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: /^Início/ })) })
  await p.waitForTimeout(800); await shot('lia-7-inicio-depois')
  log('scroll lateral:', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))
  // Oz com vários livros: o Início
  await p.goto(BASE + '/app/?exemplo'); await p.waitForTimeout(1500); await shot('lia-8-oz-inicio')
  const cont = await p.getByRole('button', { name: 'Continuar escrevendo' }).boundingBox().catch(() => null)
  log('Oz: Continuar em y=', cont && Math.round(cont.y), 'altura tela 664')
  await b.close()
})()
