import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const localApiProxyTarget =
  process.env.VITE_LOCAL_API_TARGET || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: localApiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
