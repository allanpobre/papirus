// Mede o app como num celular fraco: tela de 390 px e processador 4 vezes mais lento (CDP).
// Abre o exemplo de Oz (o livro inteiro) e passa por cada tela, medindo:
//  - "até calmar": do toque até a tela parar de mudar (200 ms sem mudança);
//  - "travado": soma do tempo em tarefas longas (>50 ms), em que o app não responde ao toque.
// Uso: node scripts/medir-celular.mjs [--sem-build] [--rodadas=2] [--lento=4] [--telas=Ligações,Fichas]   (PW_CHROMIUM_PATH aponta para um Chromium instalado)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const arg = (nome, padrao) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? padrao
const RODADAS = Number(arg('rodadas', 2))
const LENTO = Number(arg('lento', 4))
const SO = arg('telas', '')
const PORT = 4178
const base = `http://localhost:${PORT}`

if (!process.argv.includes('--sem-build') && spawnSync('npx', ['vite', 'build'], { stdio: 'ignore' }).status !== 0) {
  console.error('O build falhou.')
  process.exit(1)
}
const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 40; i++) {
  if (await fetch(base).then((r) => r.ok, () => false)) break
  await new Promise((r) => setTimeout(r, 250))
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
const areas = (page) => page.getByRole('navigation', { name: 'Áreas' })
const mais = (page) => areas(page).getByRole('button', { name: /^Mais/ })

/** Abre uma área pelo menu do celular (pelo "Mais" quando ela não está na barra de baixo). */
async function abrir(page, area) {
  const direto = areas(page).getByRole('button', { name: new RegExp(`^${area}`) }).first()
  if (await direto.isVisible()) return direto.click()
  await mais(page).click()
  await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: area, exact: true }).click()
}
const parte = (nome) => async (page) => {
  await abrir(page, 'Mundo')
  await page.locator('[data-tour="partes"]').getByRole('button', { name: nome }).click()
}

const TODAS = [
  ['Início', (p) => abrir(p, 'Início')],
  ['Escrever', (p) => abrir(p, 'Escrever')],
  ['Fichas', (p) => abrir(p, 'Mundo')],
  ['Ligações', parte('Ligações')],
  ['Linha do tempo', parte('Linha do tempo')],
  ['Mapas', parte('Mapas')],
  ['Trama', (p) => abrir(p, 'Trama')],
  ['Publicar', (p) => abrir(p, 'Publicar')],
  ['Mesa', (p) => abrir(p, 'Mesa')],
]

const TELAS = SO ? TODAS.filter(([n]) => SO.split(',').includes(n)) : TODAS

/** Roda a ação e devolve [ms até calmar, ms travado]. */
async function medir(page, acao) {
  await page.evaluate(() => {
    window.__m = { ultima: 0, travado: 0 }
    new MutationObserver(() => (window.__m.ultima = performance.now())).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__m.travado += e.duration))).observe({ type: 'longtask', buffered: false })
    window.__m.t0 = performance.now()
    window.__m.ultima = window.__m.t0
  })
  await acao(page)
  await page.waitForFunction(() => performance.now() - window.__m.ultima > 400, null, { timeout: 60_000, polling: 100 })
  return page.evaluate(() => [Math.round(window.__m.ultima - window.__m.t0 - 0), Math.round(window.__m.travado)])
}

const resultado = new Map(TELAS.map(([n]) => [n, []]))
try {
  for (let r = 0; r < RODADAS; r++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    await ctx.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
    const page = await ctx.newPage()
    await page.goto(`${base}/app/?exemplo`, { waitUntil: 'networkidle' })
    await areas(page).getByRole('button', { name: /^Mundo/ }).first().waitFor()
    // Só o processador mais lento a partir daqui (o carregamento inicial não conta).
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: LENTO })
    await page.waitForTimeout(1500)
    for (const [nome, ir] of TELAS) resultado.get(nome).push(await medir(page, ir))
    await ctx.close()
  }
} finally {
  await browser.close()
  servidor.kill()
}

const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]
const linhas = [...resultado].map(([nome, v]) => ({ nome, calmar: mediana(v.map((x) => x[0])), travado: mediana(v.map((x) => x[1])) }))
console.log(`\nCelular de 390 px, CPU ${LENTO}x mais lenta, mediana de ${RODADAS} rodada(s):\n`)
console.log('| Tela | Até calmar (ms) | Travado (ms) |\n| --- | ---: | ---: |')
for (const l of linhas) console.log(`| ${l.nome} | ${l.calmar} | ${l.travado} |`)
const piores = [...linhas].sort((a, b) => b.travado - a.travado).slice(0, 3).map((l) => l.nome)
console.log(`\nAs 3 mais pesadas (pelo tempo travado): ${piores.join(', ')}`)
process.exit(0)
