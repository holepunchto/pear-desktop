import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default {
  base: './',
  root: path.join(__dirname, 'renderer'),
  build: {
    outDir: path.join(__dirname, 'dist')
  },
  plugins: [react(), tailwindcss()]
}
