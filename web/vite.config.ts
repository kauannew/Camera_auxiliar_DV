import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// COOP/COEP habilitam SharedArrayBuffer → ONNX Runtime WASM com várias threads.
// O backend FastAPI manda os mesmos cabeçalhos em produção.
const isolamento = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: isolamento,
    // permite abrir o servidor de desenvolvimento por um túnel HTTPS (cloudflared/ngrok)
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
    proxy: {
      "/deteccoes": BACKEND,
      "/obstaculos": BACKEND,
      "/mapa": BACKEND,
      "/saude": BACKEND,
    },
  },
  preview: { headers: isolamento },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  build: {
    target: "es2022",
    rollupOptions: {
      // index.html = nova interface React; legacy.html = interface anterior (calibração/bench)
      input: { main: resolve(import.meta.dirname, "index.html"), legacy: resolve(import.meta.dirname, "legacy.html") },
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
