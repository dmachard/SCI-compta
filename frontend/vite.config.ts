/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'
import fs from 'node:fs'
import path from 'node:path'

const appVersion = process.env.VITE_APP_VERSION || `v${pkg.version}`

function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-replacement',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js') {
          const swPath = path.resolve(__dirname, 'public/sw.js')
          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf-8')
            content = content.replace(/__SW_VERSION__/g, appVersion)
            res.setHeader('Content-Type', 'application/javascript')
            res.end(content)
            return
          }
        }
        next()
      })
    },
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')
        content = content.replace(/__SW_VERSION__/g, appVersion)
        fs.writeFileSync(swPath, content, 'utf-8')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swVersionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
