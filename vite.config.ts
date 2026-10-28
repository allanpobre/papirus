import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
