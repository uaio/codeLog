import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      // eruda is a workspace symlink resolving outside node_modules; include it explicitly
      include: [/packages\/eruda/, /node_modules/]
    },
    lib: {
      entry: './src/index.ts',
      name: 'CodeLog',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'index.js';
        if (format === 'cjs') return 'index.cjs';
        return 'codelog.iife.js'; // CDN 专用产物
      }
    },
    rollupOptions: {
      // No external deps for browser IIFE — eruda and all deps bundled inline.
      input: {
        index: './src/index.ts'
      },
      output: {
        exports: 'named'
      }
    }
  },
  plugins: [
    dts({ rollupTypes: true }),
    cssInjectedByJsPlugin({ topExecutionPriority: false })
  ],
  test: {
    include: ['**/test/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
