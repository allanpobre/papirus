// Prova que o app abre sem internet: build, servidor de verdade (vite preview) e Chromium com a rede cortada.
// Uso: node scripts/testar-offline.mjs [--sem-build]   (PW_CHROMIUM_PATH aponta para um Chromium já instalado)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const PORT = 4179
const base = `http://localhost:${PORT}`
const areas = (page) => page.getByRole('navigation', { name: 'Áreas' })
const feitos = []
const erros = []
const confere = (ok, texto) => {
  ;(ok ? feitos : erros).push(texto)
  console.log(`${ok ? '✓' : '✗'} ${texto}`)
}

if (!process.argv.includes('--sem-build')) {
  const b = spawnSync('npx', ['vite', 'build'], { stdio: 'ignore' })
  if (b.status !== 0) {
    console.error('O build falhou.')
    process.exit(1)
  }
}

const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const fim = async (codigo) => {
  servidor.kill()
  process.exit(codigo)
}
for (let i = 0; i < 40; i++) {
  if (await fetch(base).then((r) => r.ok, () => false)) break
  await new Promise((r) => setTimeout(r, 250))
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } })
  const page = await ctx.newPage()
  const falhas = []
  page.on('requestfailed', (r) => falhas.push(r.url().replace(base, '')))

  // 1) Primeira visita, com internet: o service worker assume e baixa tudo.
  await page.goto(`${base}/app/?exemplo`, { waitUntil: 'networkidle' })
  await areas(page).getByRole('button', { name: /^Mundo/ }).first().waitFor()
  const lista = await (await fetch(`${base}/precache.json`)).json()
  await page.waitForFunction(
    async (n) => {
      const c = await caches.open('papirus-v4')
      return (await c.keys()).length >= n
    },
    lista.files.length,
    { timeout: 30_000 },
  )
  confere(true, `service worker guardou os ${lista.files.length} arquivos do app`)
  await page.reload({ waitUntil: 'networkidle' })
  confere(await page.evaluate(() => !!navigator.serviceWorker.controller), 'o service worker controla a página')

  // 2) Sem internet: abrir de novo (com e sem "?exemplo", com e sem a barra) mostra o app.
  await ctx.setOffline(true)
  for (const caminho of ['/app/', '/app', '/app/?exemplo']) {
    falhas.length = 0
    await page.goto(base + caminho, { waitUntil: 'load' })
    // "?exemplo" abre o universo de exemplo (menu de áreas); sem ele, abre a lista de universos
    // ou o último universo aberto (o app decide); o que importa é que algo do app apareça.
    const menu = areas(page).getByRole('button', { name: /^Mundo/ }).first()
    const marca = caminho.includes('exemplo') ? menu : menu.or(page.getByRole('heading', { name: 'Papirus' }).first())
    const ok = await marca.waitFor({ timeout: 10_000 }).then(() => true, () => false)
    confere(ok && falhas.length === 0, `sem internet abre ${caminho} (arquivos que falharam: ${falhas.length})`)
  }

  // 3) Telas carregadas sob demanda (nunca abertas com internet) também aparecem.
  for (const tela of ['Mundo', 'Trama', 'Publicar', 'Mesa']) {
    await page.goto(`${base}/app/?exemplo`, { waitUntil: 'load' })
    falhas.length = 0
    if (tela === 'Publicar' || tela === 'Mesa') {
      await page.getByRole('button', { name: 'Mais', exact: true }).click()
      await page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: tela, exact: true }).click()
    } else await areas(page).getByRole('button', { name: new RegExp(`^${tela}`) }).first().click()
    await page.waitForTimeout(1500)
    const vazia = (await page.locator('main').innerText()).trim().length < 20
    confere(falhas.length === 0 && !vazia, `sem internet abre a tela ${tela} (arquivos que falharam: ${falhas.length})`)
  }
  await ctx.close()
} finally {
  await browser.close()
}
console.log(`\n${feitos.length} conferências boas, ${erros.length} com problema.`)
await fim(erros.length ? 1 : 0)
