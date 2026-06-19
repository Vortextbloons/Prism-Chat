import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  envDir: '.env',
  plugins: [react()],
  base: mode === 'production' ? '/Prism-Chat/' : '/',
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
}))
