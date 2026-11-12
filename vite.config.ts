import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: './dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ],

  // Optimize dependencies for faster development and smaller bundles
  // Based on Vercel React Best Practices - Rule 2.1 (Avoid Barrel File Imports)
  optimizeDeps: {
    include: [
      'lucide-react',      // Pre-bundle lucide-react to avoid loading 1,500+ modules
      '@radix-ui/themes',  // Pre-bundle Radix UI themes
    ],
  },

  // Ensure public dir is served correctly
  publicDir: 'public',

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      output: {
        // 禁用 manualChunks 以避免循环依赖
        // 让 Vite 自动处理 chunk 分割
        manualChunks: undefined,
      },
    },
    // 设置合理的 chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
  },
}));
