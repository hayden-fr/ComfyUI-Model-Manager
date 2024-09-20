import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  build: {
    outDir: 'web',
    minify: 'esbuild',
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: true,
    },
  },

  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
})
