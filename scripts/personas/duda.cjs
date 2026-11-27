const { chromium } = require('playwright')
const BASE = process.env.BASE ?? 'http://localhost:5179'
const OUT = process.env.OUT ?? 'personas-saida'
const { zipSync, strToU8 } = require('fflate')
const log = (...a) => console.log(...a)
;(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  const c = await b.newContext({ viewport: { width: 1366, height: 800 } })
  const p = await c.newPage()
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` })
  const step = async (n, f) => { try { await f(); log('ok', n) } catch (e) { log('FALHOU', n, e.message.split('\n')[0]); await shot('erro-' + n.replace(/\W+/g, '-')) } }
  await p.goto(BASE + '/')
  await step('apresentação → Começar', () => p.getByRole('link', { name: 'Começar a escrever' }).first().click())
  await step('Já tenho um mundo', () => p.getByRole('button', { name: /Já tenho um mundo em outro app/ }).click())
  const zip = zipSync({
    'Ilhas/Personagens/Kael.md': strToU8('# Kael\nIrmão de [[Mira]]. Nasceu em [[Porto Cinza]] no ano 312.\n#protagonista'),
    'Ilhas/Personagens/Mira.md': strToU8('# Mira\nRival de [[Doran]]. Mora em [[Porto Cinza]].'),
    'Ilhas/Personagens/Doran.md': strToU8('# Doran\nAliado de [[Kael]]. A tempestade de 340 levou o pai dele.'),
    'Ilhas/Lugares/Porto Cinza.md': strToU8('# Porto Cinza\nCidade portuária, fundada em 120.'),
  })
  await step('importar zip', async () => {
    const j = p.getByRole('dialog', { name: 'Trazer de outro app' })
    await j.locator('input[type=file]').setInputFiles({ name: 'ilhas.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })
    await p.waitForTimeout(800); await shot('duda-1-importar')
    await j.getByRole('button', { name: /^Trazer \d+ fichas/ }).click()
  })
  await p.waitForTimeout(1200); await shot('duda-2-depois')
  log('URL/view:', await p.locator('.shell').getAttribute('data-view').catch(() => '?'))
  // Ligações
  await step('Ligações', async () => { await p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click(); await p.locator('[data-tour="partes"]').getByRole('button', { name: 'Ligações' }).click() })
  await p.waitForTimeout(1000); await shot('duda-3-ligacoes')
  log('faixa ligações sugeridas:', await p.getByRole('region', { name: 'Ligações achadas no texto' }).innerText().catch(() => 'não há'))
  log('faixa anos:', await p.getByRole('region', { name: 'Anos achados no texto' }).innerText().catch(() => 'não há'))
  // Atalhos
  await step('? atalhos', async () => { await p.locator('body').click({ position: { x: 700, y: 5 } }); await p.keyboard.press('Shift+?'); await p.getByRole('dialog', { name: 'Atalhos de teclado' }).waitFor(); await shot('duda-4-atalhos'); await p.keyboard.press('Escape') })
  await step('[ ] e J/K', async () => { await p.keyboard.press('['); await p.waitForTimeout(400); log('  após [ :', await p.locator('main h1').first().innerText()); await p.keyboard.press('j'); await p.waitForTimeout(400); log('  após j:', await p.getByRole('article').first().getAttribute('aria-label').catch(() => '-')) })
  await shot('duda-5-ficha')
  // Filtros
  await step('filtros e vista guardada', async () => { await p.getByRole('button', { name: /^Filtros/ }).click(); await p.waitForTimeout(300); await shot('duda-6-filtros') })
  // Exportar Obsidian
  await step('Obsidian', async () => { await p.keyboard.press('Escape'); await p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Ajustes/ }).click(); await p.getByRole('button', { name: /^Importar e wiki/ }).click(); log('  botão cofre:', await p.getByRole('button', { name: 'Baixar o cofre (.zip)' }).isVisible()) })
  // Wiki
  await step('Wiki', async () => { await p.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Mundo/ }).first().click(); await p.getByRole('button', { name: 'Wiki' }).click(); await p.waitForTimeout(1200); await shot('duda-7-wiki') })
  // Coleções no Oz
  await p.goto(BASE + '/app/?exemplo'); await p.waitForTimeout(1500)
  await step('coleções', async () => { await p.getByRole('region', { name: 'Livro atual' }).getByRole('button', { name: 'Trocar livro' }).click(); await p.waitForTimeout(400); await shot('duda-8-trocar') })
  log('erros de console?')
  await b.close()
})()
