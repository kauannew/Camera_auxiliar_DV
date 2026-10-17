// Página de benchmark (?bench): mede o tempo de inferência neste aparelho.
// O resultado sai como uma linha pronta para colar em docs/desempenho.md.

import type { Config } from "../core/config";
import { CameraWeb } from "../plataforma/web/cameraWeb";
import { DetectorWorker } from "../plataforma/web/detectorWorker";

function percentil(valores: number[], p: number): number {
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.min(ord.length - 1, Math.floor((p / 100) * ord.length))];
}

/** Quadro sintético (640x480) para medir mesmo sem câmera. */
async function quadroSintetico(): Promise<ImageBitmap> {
  const c = new OffscreenCanvas(640, 480);
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 640, 480);
  grad.addColorStop(0, "#555");
  grad.addColorStop(1, "#aaa");
  g.fillStyle = grad;
  g.fillRect(0, 0, 640, 480);
  return createImageBitmap(c);
}

export async function rodarBench(
  cfg: Config,
  video: HTMLVideoElement,
  saida: HTMLElement,
  forcarBackend?: "webgpu" | "wasm",
  execucoes = 50,
  urlImagem?: string | null,
): Promise<void> {
  const log = (t: string) => (saida.textContent += t + "\n");
  saida.textContent = "";
  log("Carregando modelo…");
  const t0 = performance.now();
  const detector = new DetectorWorker(cfg.modelo, forcarBackend);
  const backend = await detector.carregar();
  log(`Modelo pronto em ${((performance.now() - t0) / 1000).toFixed(1)} s · backend: ${backend}`);
  log(`Isolamento cross-origin (multithread): ${self.crossOriginIsolated ? "sim" : "não"}`);

  const camera = new CameraWeb(video);
  let usarCamera = !urlImagem;
  let imagem: Blob | null = null;
  if (urlImagem) {
    imagem = await (await fetch(urlImagem)).blob();
    log(`Usando a imagem ${urlImagem}.`);
  } else {
    try {
      await camera.iniciar();
      log("Usando quadros da câmera.");
    } catch {
      usarCamera = false;
      log("Câmera indisponível: usando quadro sintético.");
    }
  }

  const pegarQuadro = async () =>
    imagem
      ? createImageBitmap(imagem)
      : ((usarCamera ? ((await camera.capturar()) as ImageBitmap | null) : null) ?? quadroSintetico());

  // aquecimento + amostra do que o modelo vê (útil para conferir o pós-processamento)
  const amostra = await detector.detectar(await pegarQuadro());
  for (const d of amostra.deteccoes.slice(0, 8)) {
    const c = d.caixa;
    log(`  ${detector.classes[d.classe]} ${(d.confianca * 100).toFixed(0)}% [${c.x1.toFixed(2)}, ${c.y1.toFixed(2)}, ${c.x2.toFixed(2)}, ${c.y2.toFixed(2)}]`);
  }
  for (let i = 0; i < 2; i++) await detector.detectar(await pegarQuadro());

  const inferencia: number[] = [];
  const total: number[] = [];
  for (let i = 0; i < execucoes; i++) {
    const inicio = performance.now();
    const r = await detector.detectar(await pegarQuadro());
    total.push(performance.now() - inicio);
    inferencia.push(r.msInferencia);
    if (i % 10 === 9) log(`… ${i + 1}/${execucoes}`);
  }
  camera.parar();

  const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mediaTotal = media(total);
  log("");
  log(`Inferência: média ${media(inferencia).toFixed(1)} ms · p50 ${percentil(inferencia, 50).toFixed(1)} · p95 ${percentil(inferencia, 95).toFixed(1)}`);
  log(`Quadro completo (captura + pré + inferência + NMS): média ${mediaTotal.toFixed(1)} ms → até ${(1000 / mediaTotal).toFixed(1)} FPS`);
  log("");
  log("Linha para docs/desempenho.md:");
  const data = new Date().toISOString().slice(0, 10);
  const modelo = cfg.modelo.url.split("/").pop();
  log(
    `| ${data} | ${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? "?"} | ${navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? "?"} | ${backend} | ${modelo} | ${media(inferencia).toFixed(1)} | ${percentil(inferencia, 95).toFixed(1)} | ${(1000 / mediaTotal).toFixed(1)} | ${imagem ? "imagem" : usarCamera ? "câmera" : "sintético"} |`,
  );
}
