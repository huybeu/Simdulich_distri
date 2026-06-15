import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base chỉ áp dụng khi build production (VITE_BASE_PATH=/distri/)
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/webhooks": "http://localhost:4000",
    },
  },
})
