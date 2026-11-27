const { chromium } = require('playwright')
const BASE = process.env.BASE ?? 'http://localhost:5179'
const OUT = process.env.OUT ?? 'personas-saida'
const log = (...a) => console.log(...a)
;(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  const c = await b.newContext({ viewport: { width: 1366, height: 800 } })
  const p = await c.newPage()
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` })
  const step = async (n, f) => { try { await f(); log('ok', n) } catch (e) { log('FALHOU', n, e.message.split('\n')[0]); await shot('erro-' + n.replace(/\W+/g, '-')) } }
  await p.goto(BASE + '/')
  await step('Começar a mestrar', () => p.getByRole('link', { name: /Começar a mestrar/ }).first().click().catch(() => p.getByRole('button', { name: /Começar a mestrar/ }).first().click()))
  await p.waitForTimeout(800); await shot('rafa-1-primeira')
  await step('criar campanha', async () => {
    const nome = p.getByRole('textbox', { name: 'Nome da campanha' })
    if (!(await nome.count())) await p.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Campanhas' }).click()
    await p.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras de Varn')
    await p.getByRole('button', { name: 'Criar campanha' }).click()
  })
  await p.waitForTimeout(1200); await shot('rafa-2-mesa')
  log('telas:', await p.locator('main h1').first().innerText().catch(() => '-'))
  log('botões visíveis na Mesa:', (await p.locator('main button:visible').allInnerTexts()).filter(Boolean).slice(0, 25).join(' | '))
  // Ostria: sessão pronta
  await p.goto(BASE + '/app/?exemplo=ostria'); await p.waitForTimeout(1200)
  await step('Mesa → começar sessão', async () => { await p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mesa/ }).first().click(); await p.waitForTimeout(600); await shot('rafa-3-mesa-ostria'); await p.getByRole('button', { name: 'Começar agora' }).click(); await p.getByRole('button', { name: 'Começar a jogar' }).click() })
  await p.waitForTimeout(1200); await shot('rafa-4-sessao')
  await step('Codex no Grupo', async () => { await p.getByRole('region', { name: 'Grupo', exact: true }).getByText(/^Codex: mostrar aos jogadores/).click(); await p.waitForTimeout(400); await shot('rafa-5-codex') })
  await step('rolagem rápida', async () => { const r = p.getByRole('button', { name: /^d20$/ }).first(); log('  d20 existe?', await r.count()) })
  // Celular no modo sessão
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(800); await shot('rafa-6-sessao-celular')
  log('abas da sessão no celular:', await p.getByRole('navigation', { name: 'Partes da sessão' }).locator('button').allInnerTexts().catch(() => '-'))
  log('scroll lateral:', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))
  await b.close()
})()
