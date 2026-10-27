import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const adminPort = Number(process.env.WEE_CHECK_ADMIN_PORT || 4173)

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${adminPort}`,
      '/events': `http://127.0.0.1:${adminPort}`,
    },
  },
})
