import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/eapi': {
        target: 'https://eapi.binance.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
