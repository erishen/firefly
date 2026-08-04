import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // 本地 LLM 代理（server/proxy.mjs），前端只请求同源 /api
      '/api': 'http://localhost:8787',
    },
  },
})