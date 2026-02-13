/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/RackUp/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5177,
    proxy: {
      '/api': 'http://localhost:4077',
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
