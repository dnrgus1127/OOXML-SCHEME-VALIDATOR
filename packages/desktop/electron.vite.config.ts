import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const workspaceRoot = resolve(__dirname, '../..')

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@ooxml/core', '@ooxml/parser']
      })
    ],
    resolve: {
      alias: {
        '@ooxml/core': resolve(workspaceRoot, 'packages/core/src/index.ts'),
        '@ooxml/parser': resolve(workspaceRoot, 'packages/parser/src/index.ts')
      }
    },
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      },
        sourcemap: true,
        minify: false
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: 'index.html'
      }
    }
  }
})
