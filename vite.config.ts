import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // O editor (TipTap) e o SDK da IA ficam em blocos próprios, carregados só quando usados;
    // o bloco do editor passa um pouco de 500 kB e isso é esperado.
    chunkSizeWarningLimit: 600,
  },
})
