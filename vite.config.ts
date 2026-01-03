import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['crypto', 'buffer', 'stream', 'util'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    define: {
      // Polyfill process.env for existing code compatibility
      define: {
        // Polyfill process.env for existing code compatibility
        'process.env.DATABASE_URL': JSON.stringify(process.env.DATABASE_URL || env.DATABASE_URL),
        'process.env.VITE_DATABASE_URL': JSON.stringify(process.env.VITE_DATABASE_URL || env.VITE_DATABASE_URL),
        'process.env': env
      }
    }
  }
})