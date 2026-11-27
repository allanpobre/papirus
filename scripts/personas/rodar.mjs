/*
 * As quatro personas usam o app, cada uma começando pela apresentação (ver docs/personas.md).
 * Uso: com o servidor de pé (npx vite --port 5179 --strictPort), rode
 *   node scripts/personas/rodar.mjs            (todas)
 *   node scripts/personas/rodar.mjs lia rafa   (só algumas)
 * Saída: o registro de cada passo no terminal e as fotos em personas-saida/ (fora do git).
 * No ambiente da nuvem: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const todas = ['lia', 'duda', 'rafa', 'beto']
const escolhidas = process.argv.slice(2).length ? process.argv.slice(2) : todas
mkdirSync(process.env.OUT ?? 'personas-saida', { recursive: true })
let falhou = false
for (const nome of escolhidas) {
  if (!todas.includes(nome)) {
    console.error(`Persona desconhecida: ${nome} (são ${todas.join(', ')})`)
    process.exit(1)
  }
  console.log(`\n=== ${nome.toUpperCase()} ===`)
  const r = spawnSync(process.execPath, [join(aqui, `${nome}.cjs`)], { stdio: 'inherit' })
  if (r.status !== 0) falhou = true
}
process.exit(falhou ? 1 : 0)
