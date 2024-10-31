import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, Plugin } from 'vite'

function css(): Plugin {
  return {
    name: 'vite-plugin-css-inject',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const cssCode: string[] = []

      for (const key in bundle) {
        if (Object.prototype.hasOwnProperty.call(bundle, key)) {
          const chunk = bundle[key]
          if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
            cssCode.push(<string>chunk.source)
            delete bundle[key]
          }
        }
      }

      for (const key in bundle) {
        if (Object.prototype.hasOwnProperty.call(bundle, key)) {
          const chunk = bundle[key]
          if (chunk.type === 'chunk' && /index-.*\.js$/.test(chunk.fileName)) {
            const originalCode = chunk.code
            chunk.code = '(function(){var s=document.createElement("style");'
            chunk.code += 's.type="text/css",s.dataset.styleId="model-manager",'
            chunk.code += 's.appendChild(document.createTextNode('
            chunk.code += JSON.stringify(cssCode.join(''))
            chunk.code += ')),document.head.appendChild(s);})();'
            chunk.code += originalCode
          }
        }
      }
    },
  }
}

function output(): Plugin {
  return {
    name: 'vite-plugin-output-fix',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const key in bundle) {
        const chunk = bundle[key]

        if (chunk.type === 'asset') {
          if (chunk.fileName === 'index.html') {
            delete bundle[key]
          }
        }

        if (chunk.fileName.startsWith('assets/')) {
          chunk.fileName = chunk.fileName.replace('assets/', '')
        }
      }
    },
  }
}

function dev(): Plugin {
  return {
    name: 'vite-plugin-dev-fix',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      server.httpServer?.on('listening', () => {
        const rootDir = server.config.root
        const outDir = server.config.build.outDir

        const outDirPath = path.join(rootDir, outDir)
        if (fs.existsSync(outDirPath)) {
          fs.rmSync(outDirPath, { recursive: true })
        }
        fs.mkdirSync(outDirPath)

        const port = server.config.server.port
        const content = `import "http://127.0.0.1:${port}/src/main.ts";`
        fs.writeFileSync(path.join(outDirPath, 'manager-dev.js'), content)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), css(), output(), dev()],

  build: {
    outDir: 'web',
    minify: 'esbuild',
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: true,
      output: {
        manualChunks(id) {
          if (id.includes('primevue')) {
            return 'primevue'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1024,
  },

  resolve: {
    alias: {
      src: resolvePath('src'),
      components: resolvePath('src/components'),
      hooks: resolvePath('src/hooks'),
      scripts: resolvePath('src/scripts'),
      types: resolvePath('src/types'),
      utils: resolvePath('src/utils'),
    },
  },

  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
})

function resolvePath(str: string) {
  return path.resolve(__dirname, str)
}
