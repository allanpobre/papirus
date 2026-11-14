// Resume o relatório JSON do Playwright: tempo por arquivo, testes que falharam e os que só passaram na repetição (instáveis).
// Uso:
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/e2e.json npx playwright test --trace off --reporter=json >/dev/null
//   node scripts/resumo-e2e.mjs /tmp/e2e.json
import { readFileSync } from 'node:fs'

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('Uso: node scripts/resumo-e2e.mjs relatorio.json')
  process.exit(1)
}
const relatorio = JSON.parse(readFileSync(arquivo, 'utf8'))
const porArquivo = new Map()
const problemas = []
const visitar = (suite, arquivoDoTeste) => {
  for (const spec of suite.specs ?? []) {
    for (const teste of spec.tests) {
      const atual = porArquivo.get(arquivoDoTeste) ?? { testes: 0, ms: 0 }
      atual.testes++
      atual.ms += teste.results.reduce((soma, r) => soma + r.duration, 0)
      porArquivo.set(arquivoDoTeste, atual)
      if (teste.status !== 'expected' && teste.status !== 'skipped') problemas.push(`${arquivoDoTeste} › ${spec.title} (${teste.status})`)
    }
  }
  for (const filha of suite.suites ?? []) visitar(filha, arquivoDoTeste)
}
for (const suite of relatorio.suites) visitar(suite, suite.file)

console.log('| Arquivo | Testes | Tempo (s) |\n| --- | ---: | ---: |')
for (const [nome, { testes, ms }] of [...porArquivo].sort((a, b) => b[1].ms - a[1].ms)) console.log(`| ${nome} | ${testes} | ${(ms / 1000).toFixed(1)} |`)
const { expected, unexpected, flaky, skipped } = relatorio.stats
console.log(`\nPassaram: ${expected} · falharam: ${unexpected} · instáveis: ${flaky} · pulados: ${skipped} · tempo de parede: ${(relatorio.stats.duration / 1000).toFixed(0)} s`)
if (problemas.length) console.log(`\nPara olhar:\n- ${problemas.join('\n- ')}`)
process.exit(unexpected || flaky ? 1 : 0)
