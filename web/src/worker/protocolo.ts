// Mensagens trocadas entre a thread principal e o worker de inferência.

import type { DeteccaoBruta } from "../core/tipos";

export type MensagemParaWorker =
  | {
      tipo: "carregar";
      urlModelo: string;
      imgsz: number;
      numClasses: number;
      confMin: number;
      iouNms: number;
      /** Força o backend: "webgpu" | "wasm"; undefined = automático. */
      forcarBackend?: "webgpu" | "wasm";
    }
  | { tipo: "detectar"; id: number; quadro: ImageBitmap };

export type MensagemDoWorker =
  | { tipo: "pronto"; backend: string }
  | { tipo: "resultado"; id: number; deteccoes: DeteccaoBruta[]; msInferencia: number }
  | { tipo: "erro"; id?: number; mensagem: string };
