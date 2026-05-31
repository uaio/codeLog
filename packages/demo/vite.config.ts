import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Dev middleware: serve local SDK IIFE from packages/sdk/dist
const localSdkPlugin = () => ({
  name: 'local-sdk',
  configureServer(server: any) {
    server.middlewares.use('/codelog.iife.js', (_req: any, res: any) => {
      const sdkPath = resolve(__dirname, '../sdk/dist/codelog.iife.js')
      if (!fs.existsSync(sdkPath)) {
        res.statusCode = 404
        res.end('SDK not built. Run: pnpm --filter @codelog/sdk build')
        return
      }
      res.setHeader('Content-Type', 'application/javascript')
      res.end(fs.readFileSync(sdkPath))
    })
  }
})

export default defineConfig({
  plugins: [react(), localSdkPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5274,
    open: false
  }
})
