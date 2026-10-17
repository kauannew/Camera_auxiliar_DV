/// <reference lib="webworker" />
// Worker de inferência: roda o YOLO com o ONNX Runtime Web FORA da thread
// principal, para a interface (e a fala) nunca travarem.
//
// Backend: WebGPU quando disponível (build "asyncify" do ORT, ~27 MB, ~6,7 MB gzip);
// senão WASM puro (~14 MB, ~3,7 MB gzip). O build é importado dinamicamente para o aparelho
// sem WebGPU não baixar o arquivo maior.

import { calcularLetterbox, decodificarYolo } from "../core/posprocessamento";
import type { MensagemDoWorker, MensagemParaWorker } from "./protocolo";

type Ort = typeof import("onnxruntime-web");

declare const self: DedicatedWorkerGlobalScope;

let ort: Ort;
let sessao: import("onnxruntime-web").InferenceSession;
let nomeEntrada = "images";
let cfg: Extract<MensagemParaWorker, { tipo: "carregar" }>;
let tela: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let entrada: Float32Array;

const enviar = (m: MensagemDoWorker) => self.postMessage(m);

async function temWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function carregar(m: Extract<MensagemParaWorker, { tipo: "carregar" }>) {
  cfg = m;
  const usarWebGPU = m.forcarBackend ? m.forcarBackend === "webgpu" : await temWebGPU();
  ort = usarWebGPU ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web/wasm");

  // Várias threads só com isolamento cross-origin (COOP/COEP) → SharedArrayBuffer
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

  const modelo = new Uint8Array(await (await fetch(m.urlModelo)).arrayBuffer());
  let backend = usarWebGPU ? "webgpu" : "wasm";
  try {
    sessao = await ort.InferenceSession.create(modelo, {
      executionProviders: [backend],
      graphOptimizationLevel: "all",
    });
  } catch (erro) {
    if (backend !== "webgpu") throw erro;
    // WebGPU anunciado mas falhou ao montar o grafo → cai para WASM no mesmo build
    console.warn("WebGPU falhou, usando WASM:", erro);
    backend = "wasm";
    sessao = await ort.InferenceSession.create(modelo, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  }
  nomeEntrada = sessao.inputNames[0];

  tela = new OffscreenCanvas(m.imgsz, m.imgsz);
  ctx = tela.getContext("2d", { willReadFrequently: true })!;
  entrada = new Float32Array(3 * m.imgsz * m.imgsz);

  // Aquecimento: a primeira execução compila shaders/kernels e é bem mais lenta
  await sessao.run({ [nomeEntrada]: new ort.Tensor("float32", entrada, [1, 3, m.imgsz, m.imgsz]) });

  const threads = backend === "wasm" ? ` (${ort.env.wasm.numThreads} thread${ort.env.wasm.numThreads > 1 ? "s" : ""})` : "";
  enviar({ tipo: "pronto", backend: backend + threads });
}

async function detectar(id: number, quadro: ImageBitmap) {
  const t = cfg.imgsz;
  const lb = calcularLetterbox(quadro.width, quadro.height, t);

  // Letterbox: fundo cinza 114 (igual ao treino) + imagem centralizada mantendo a proporção
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, t, t);
  ctx.drawImage(quadro, lb.padX, lb.padY, Math.round(quadro.width * lb.escala), Math.round(quadro.height * lb.escala));
  quadro.close();

  // RGBA intercalado → RGB planar (NCHW) normalizado 0..1
  const pixels = ctx.getImageData(0, 0, t, t).data;
  const area = t * t;
  for (let i = 0, p = 0; i < area; i++, p += 4) {
    entrada[i] = pixels[p] / 255;
    entrada[area + i] = pixels[p + 1] / 255;
    entrada[2 * area + i] = pixels[p + 2] / 255;
  }

  const inicio = performance.now();
  const saidas = await sessao.run({ [nomeEntrada]: new ort.Tensor("float32", entrada, [1, 3, t, t]) });
  const msInferencia = performance.now() - inicio;

  const saida = saidas[sessao.outputNames[0]];
  const [, linhas, ancoras] = saida.dims as number[];
  const deteccoes = decodificarYolo(saida.data as Float32Array, ancoras, lb, {
    numClasses: linhas - 4,
    confMin: cfg.confMin,
    iouNms: cfg.iouNms,
  });
  saida.dispose?.();
  enviar({ tipo: "resultado", id, deteccoes, msInferencia });
}

self.onmessage = async (ev: MessageEvent<MensagemParaWorker>) => {
  const m = ev.data;
  try {
    if (m.tipo === "carregar") await carregar(m);
    else if (m.tipo === "detectar") await detectar(m.id, m.quadro);
  } catch (erro) {
    if (m.tipo === "detectar") m.quadro.close?.();
    enviar({ tipo: "erro", id: m.tipo === "detectar" ? m.id : undefined, mensagem: String(erro) });
  }
};
