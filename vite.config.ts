/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

const gitHash = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  base: '/RackUp/',
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(gitHash),
  },
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
