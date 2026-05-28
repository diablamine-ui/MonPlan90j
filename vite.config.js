import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 3000,
    target: 'es2015',
    rollupOptions: {
      input: './index.html'
    }
  }
})
