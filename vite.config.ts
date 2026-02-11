/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/RackUp/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4010',
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
