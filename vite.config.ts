import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localApiProxyTarget = env.VITE_LOCAL_API_TARGET?.trim();
  const localProxy = localApiProxyTarget
    ? {
        "/api": {
          target: localApiProxyTarget,
          changeOrigin: true,
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: localProxy ? { proxy: localProxy } : undefined,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
