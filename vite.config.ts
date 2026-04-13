import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/crazy-checkers/',
  define: {
    // Exposed as import.meta.env.VITE_APP_VERSION at runtime and used
    // by the data-export envelope so users know which version produced
    // their backup file.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
