import { defineConfig } from "vitest/config";

// COOP/COEP habilitam SharedArrayBuffer → ONNX Runtime WASM com várias threads.
// O backend FastAPI manda os mesmos cabeçalhos em produção.
const isolamento = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
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
  build: { target: "es2022" },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
