// Combate com 15 participantes no celular, CPU 4x mais lenta: mede passar o turno, abrir a linha, PV e condição com duração.
// Uso: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/medir-combate.mjs [lentidão=4] [endereço=http://localhost:5180/app/]
// Para números de verdade, rode contra o app construído (npm run build && npx vite preview --port 5180): o servidor de
// desenvolvimento é de 3 a 5 vezes mais lento por causa do React em modo de desenvolvimento.
import { chromium } from 'playwright'
const throttle = Number(process.argv[2] ?? 4)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await page.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
await page.goto('http://localhost:5179/app/')
await page.getByRole('button', { name: /O Alienista, de Machado de Assis/ }).click()
await page.getByRole('button', { name: 'Mais', exact: true }).click()
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
// Rola por quem ainda não rolou.
for (let i = 0; i < 40; i++) {
  const b = init.getByRole('button', { name: /^Rolar por /, }).first()
  if (!(await b.count())) break
  await b.click()
}
const turnos = init.getByRole('button', { name: 'Definir turnos' })
await turnos.click()
const n = await page.locator('.fight-row').count()
console.log('participantes:', n)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const timed = async (label, fn) => {
  const m0 = await metrics()
  const t0 = Date.now()
  await fn()
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const m1 = await metrics()
  const ms = (k) => Math.round((m1[k] - m0[k]) * 1000)
  console.log(label.padEnd(34), 'tarefa', String(ms('TaskDuration')).padStart(5), 'ms | script', String(ms('ScriptDuration')).padStart(5), '| estilo', String(ms('RecalcStyleDuration')).padStart(4), '| layout', String(ms('LayoutDuration')).padStart(4), '| parede', String(Date.now() - t0).padStart(5))
}
const proxima = page.getByRole('button', { name: /^Próxima vez/ })
for (let i = 0; i < 4; i++) await timed(`Próxima vez #${i + 1}`, () => proxima.click())
// abre a lista e uma linha
await timed('abrir "Vida, Defesa e condições"', () => page.locator('.fight-more summary', { hasText: 'Vida, Defesa e condições' }).click())
const goblin = page.locator('.fight-row', { hasText: /Goblin 3/ }).first()
await timed('abrir a linha do Goblin 3', () => goblin.locator('.fight-line').click())
const hp = page.getByRole('textbox', { name: /^PV de Goblin 3/ })
if (await hp.count()) {
  await timed('dano: digitar PV do Goblin 3', async () => { await hp.fill('2/7') })
}
const cond = page.getByRole('combobox', { name: /^Adicionar condição a Goblin 3/ })
if (await cond.count()) {
  await timed('condição: escolher', () => cond.selectOption({ index: 1 }))
  await timed('condição: duração 3 rodadas', () => page.getByRole('combobox', { name: /^Quanto tempo dura/ }).selectOption({ label: '3 rodadas' }))
}
await timed('Próxima vez (com linha aberta)', () => proxima.click())
for (let i = 0; i < 3; i++) await timed(`Próxima vez #${i + 5}`, () => proxima.click())
// uma volta inteira: fim da rodada expira as condições
await timed('15 vezes seguidas (uma rodada)', async () => { for (let i = 0; i < 15; i++) await proxima.click() })
console.log('rodada:', await page.locator('.round-pill').innerText())
await browser.close()
