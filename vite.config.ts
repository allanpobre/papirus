import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }

/**
 * Escreve `precache.json` ao lado do site: a lista de tudo que o app precisa para abrir sem internet
 * (scripts, estilos e fontes). A página manda essa lista ao service worker depois de abrir (src/pwa.ts).
 */
function precacheList(): Plugin {
  return {
    name: 'papirus-precache',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2)$/.test(f))
        .sort()
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify({ files }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheList()],
  // A versão do package.json, mostrada em Ajustes e na apresentação.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    // O editor (TipTap) e o SDK da IA ficam em blocos próprios, carregados só quando usados;
    // o bloco do editor passa um pouco de 500 kB e isso é esperado.
    chunkSizeWarningLimit: 600,
    // Duas páginas: a apresentação (/) e o app (/app/).
    rollupOptions: {
      input: { apresentacao: 'index.html', app: 'app/index.html' },
    },
  },
})
