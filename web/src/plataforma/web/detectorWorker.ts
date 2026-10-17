// Adaptador Detector → Web Worker com ONNX Runtime Web.

import type { Config } from "../../core/config";
import { ErroPlataforma, type Detector, type Quadro, type ResultadoDeteccao } from "../../core/portas";
import type { RotulosModelo } from "../../core/tipos";
import type { MensagemDoWorker, MensagemParaWorker } from "../../worker/protocolo";

export class DetectorWorker implements Detector {
  private worker: Worker | null = null;
  private proximoId = 1;
  private pendentes = new Map<number, { ok: (r: ResultadoDeteccao) => void; erro: (e: Error) => void }>();
  classes: string[] = [];
  nomesFalados: string[] = [];

  constructor(
    private readonly cfg: Config["modelo"],
    private readonly forcarBackend?: "webgpu" | "wasm",
  ) {}

  async carregar(): Promise<string> {
    let rotulos: RotulosModelo;
    try {
      rotulos = await (await fetch(this.cfg.rotulos)).json();
    } catch (e) {
      throw new ErroPlataforma("falha", `Não foi possível ler ${this.cfg.rotulos}: ${e}`);
    }
    this.classes = rotulos.classes;
    this.nomesFalados = rotulos.nomes_falados ?? rotulos.classes;

    this.worker = new Worker(new URL("../../worker/inferencia.worker.ts", import.meta.url), { type: "module" });
    return new Promise<string>((resolve, reject) => {
      const w = this.worker!;
      w.onmessage = (ev: MessageEvent<MensagemDoWorker>) => {
        const m = ev.data;
        if (m.tipo === "pronto") resolve(m.backend);
        else if (m.tipo === "resultado") {
          this.pendentes.get(m.id)?.ok({ deteccoes: m.deteccoes, msInferencia: m.msInferencia });
          this.pendentes.delete(m.id);
        } else if (m.tipo === "erro") {
          if (m.id === undefined) reject(new ErroPlataforma("falha", m.mensagem));
          else {
            this.pendentes.get(m.id)?.erro(new Error(m.mensagem));
            this.pendentes.delete(m.id);
          }
        }
      };
      w.onerror = (ev) => reject(new ErroPlataforma("falha", ev.message));
      const msg: MensagemParaWorker = {
        tipo: "carregar",
        urlModelo: this.cfg.url,
        imgsz: rotulos.imgsz,
        numClasses: rotulos.classes.length,
        confMin: this.cfg.confMin,
        iouNms: this.cfg.iouNms,
        forcarBackend: this.forcarBackend,
      };
      w.postMessage(msg);
    });
  }

  detectar(quadro: Quadro): Promise<ResultadoDeteccao> {
    const bitmap = quadro as ImageBitmap;
    if (!this.worker) {
      bitmap.close();
      return Promise.reject(new Error("Detector não carregado"));
    }
    const id = this.proximoId++;
    return new Promise((ok, erro) => {
      this.pendentes.set(id, { ok, erro });
      // transferência (sem cópia) do bitmap para o worker
      this.worker!.postMessage({ tipo: "detectar", id, quadro: bitmap } satisfies MensagemParaWorker, [bitmap]);
    });
  }
}
