// build/vite.config.ts
import { defineConfig } from "file:///Users/anzhiqing/Documents/github/openLog/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.37_sass@1.98.0_terser@5.46.1/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/anzhiqing/Documents/github/openLog/node_modules/.pnpm/vite-plugin-dts@3.9.1_@types+node@20.19.37_rollup@4.59.0_typescript@5.9.3_vite@5.4.21_@_1eec1d407c850546aa60da41fba2f46f/node_modules/vite-plugin-dts/dist/index.mjs";
import cssInjectedByJsPlugin from "file:///Users/anzhiqing/Documents/github/openLog/node_modules/.pnpm/vite-plugin-css-injected-by-js@4.0.1_vite@5.4.21_@types+node@20.19.37_sass@1.98.0_terser@5.46.1_/node_modules/vite-plugin-css-injected-by-js/dist/esm/index.js";
var vite_config_default = defineConfig({
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    },
    lib: {
      entry: "./src/index.ts",
      name: "CodeLog",
      formats: ["es", "cjs", "iife"],
      fileName: (format) => {
        if (format === "es") return "index.js";
        if (format === "cjs") return "index.cjs";
        return "codelog.iife.js";
      }
    },
    rollupOptions: {
      external: ["@codelog/eruda"],
      input: {
        index: "./src/index.ts"
      },
      output: {
        exports: "named"
      }
    }
  },
  plugins: [
    dts(),
    cssInjectedByJsPlugin({ topExecutionPriority: false })
  ],
  test: {
    include: ["**/test/**/*.{test,spec}.{js,ts}"],
    exclude: ["**/node_modules/**", "**/dist/**"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYnVpbGQvdml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYW56aGlxaW5nL0RvY3VtZW50cy9naXRodWIvb3BlbkxvZy9wYWNrYWdlcy9zZGsvYnVpbGRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9hbnpoaXFpbmcvRG9jdW1lbnRzL2dpdGh1Yi9vcGVuTG9nL3BhY2thZ2VzL3Nkay9idWlsZC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvYW56aGlxaW5nL0RvY3VtZW50cy9naXRodWIvb3BlbkxvZy9wYWNrYWdlcy9zZGsvYnVpbGQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcbmltcG9ydCBjc3NJbmplY3RlZEJ5SnNQbHVnaW4gZnJvbSAndml0ZS1wbHVnaW4tY3NzLWluamVjdGVkLWJ5LWpzJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYnVpbGQ6IHtcbiAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgIHRyYW5zZm9ybU1peGVkRXNNb2R1bGVzOiB0cnVlXG4gICAgfSxcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiAnLi9zcmMvaW5kZXgudHMnLFxuICAgICAgbmFtZTogJ0NvZGVMb2cnLFxuICAgICAgZm9ybWF0czogWydlcycsICdjanMnLCAnaWlmZSddLFxuICAgICAgZmlsZU5hbWU6IChmb3JtYXQpID0+IHtcbiAgICAgICAgaWYgKGZvcm1hdCA9PT0gJ2VzJykgcmV0dXJuICdpbmRleC5qcyc7XG4gICAgICAgIGlmIChmb3JtYXQgPT09ICdjanMnKSByZXR1cm4gJ2luZGV4LmNqcyc7XG4gICAgICAgIHJldHVybiAnY29kZWxvZy5paWZlLmpzJzsgLy8gQ0ROIFx1NEUxM1x1NzUyOFx1NEVBN1x1NzI2OVxuICAgICAgfVxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFsnQGNvZGVsb2cvZXJ1ZGEnXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIGluZGV4OiAnLi9zcmMvaW5kZXgudHMnXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGV4cG9ydHM6ICduYW1lZCdcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICBkdHMoKSxcbiAgICBjc3NJbmplY3RlZEJ5SnNQbHVnaW4oeyB0b3BFeGVjdXRpb25Qcmlvcml0eTogZmFsc2UgfSlcbiAgXSxcbiAgdGVzdDoge1xuICAgIGluY2x1ZGU6IFsnKiovdGVzdC8qKi8qLnt0ZXN0LHNwZWN9Lntqcyx0c30nXSxcbiAgICBleGNsdWRlOiBbJyoqL25vZGVfbW9kdWxlcy8qKicsICcqKi9kaXN0LyoqJ11cbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNXLFNBQVMsb0JBQW9CO0FBQ25ZLE9BQU8sU0FBUztBQUNoQixPQUFPLDJCQUEyQjtBQUVsQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixPQUFPO0FBQUEsSUFDTCxpQkFBaUI7QUFBQSxNQUNmLHlCQUF5QjtBQUFBLElBQzNCO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSCxPQUFPO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixTQUFTLENBQUMsTUFBTSxPQUFPLE1BQU07QUFBQSxNQUM3QixVQUFVLENBQUMsV0FBVztBQUNwQixZQUFJLFdBQVcsS0FBTSxRQUFPO0FBQzVCLFlBQUksV0FBVyxNQUFPLFFBQU87QUFDN0IsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsZ0JBQWdCO0FBQUEsTUFDM0IsT0FBTztBQUFBLFFBQ0wsT0FBTztBQUFBLE1BQ1Q7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNOLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxJQUNKLHNCQUFzQixFQUFFLHNCQUFzQixNQUFNLENBQUM7QUFBQSxFQUN2RDtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUyxDQUFDLGtDQUFrQztBQUFBLElBQzVDLFNBQVMsQ0FBQyxzQkFBc0IsWUFBWTtBQUFBLEVBQzlDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
