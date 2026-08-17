import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const projectRoot = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
  },
  envDir: projectRoot,
  root: path.resolve(projectRoot, "client"),
  publicDir: path.resolve(projectRoot, "client", "public"),
  build: {
    outDir: path.resolve(projectRoot, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          charts: ["recharts"],
          forms: ["react-hook-form", "@hookform/resolvers"],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1", "::1"],
    hmr: {
      protocol: process.env.VITE_HMR_PROTOCOL as "ws" | "wss" | undefined,
      host: process.env.VITE_HMR_HOST || undefined,
      port: process.env.VITE_HMR_PORT
        ? parseInt(process.env.VITE_HMR_PORT, 10)
        : undefined,
      clientPort: process.env.VITE_HMR_CLIENT_PORT
        ? parseInt(process.env.VITE_HMR_CLIENT_PORT, 10)
        : undefined,
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
