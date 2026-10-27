import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/analyses': 'http://127.0.0.1:8000',
      '/anomaly-analyses': 'http://127.0.0.1:8000',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
