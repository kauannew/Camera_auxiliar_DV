// Decodificação da saída do YOLO (v8/11) exportado SEM NMS + NMS por classe.
// Referência numérica em Python: training/scripts/verificar_onnx.py
//
// Saída do modelo: tensor [1, 4 + nc, N], em ordem "linha por atributo":
//   dados[0*N + i] = cx, dados[1*N + i] = cy, dados[2*N + i] = w, dados[3*N + i] = h
//   (em pixels do input imgsz×imgsz), dados[(4 + c)*N + i] = score da classe c.

import type { Caixa, DeteccaoBruta } from "./tipos";

/** Parâmetros do letterbox aplicado no pré-processamento. */
export interface Letterbox {
  escala: number;
  padX: number;
  padY: number;
  larguraOriginal: number;
  alturaOriginal: number;
}

/** Calcula o letterbox (mesma regra do Ultralytics: mantém proporção, centraliza). */
export function calcularLetterbox(largura: number, altura: number, imgsz: number): Letterbox {
  const escala = Math.min(imgsz / largura, imgsz / altura);
  const nw = Math.round(largura * escala);
  const nh = Math.round(altura * escala);
  return {
    escala,
    padX: Math.floor((imgsz - nw) / 2),
    padY: Math.floor((imgsz - nh) / 2),
    larguraOriginal: largura,
    alturaOriginal: altura,
  };
}

export function iou(a: Caixa, b: Caixa): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const uniao = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return uniao > 0 ? inter / uniao : 0;
}

/** NMS guloso por classe. Entrada em qualquer sistema de coordenadas. */
export function nms(deteccoes: DeteccaoBruta[], limiarIou: number): DeteccaoBruta[] {
  const ordenadas = [...deteccoes].sort((a, b) => b.confianca - a.confianca);
  const mantidas: DeteccaoBruta[] = [];
  for (const d of ordenadas) {
    const sobrepoe = mantidas.some((m) => m.classe === d.classe && iou(m.caixa, d.caixa) >= limiarIou);
    if (!sobrepoe) mantidas.push(d);
  }
  return mantidas;
}

export interface OpcoesDecodificacao {
  numClasses: number;
  confMin: number;
  iouNms: number;
  /** Se definido, só estas classes são consideradas. */
  classesPermitidas?: ReadonlySet<number> | null;
  /** Limite de caixas após NMS (protege o pós-processamento). */
  maxDeteccoes?: number;
}

/**
 * Converte a saída bruta em detecções normalizadas (0..1) em relação ao
 * quadro original, desfazendo o letterbox.
 */
export function decodificarYolo(
  dados: ArrayLike<number>,
  numAncoras: number,
  lb: Letterbox,
  opcoes: OpcoesDecodificacao,
): DeteccaoBruta[] {
  const { numClasses, confMin, iouNms, classesPermitidas, maxDeteccoes = 50 } = opcoes;
  const candidatas: DeteccaoBruta[] = [];

  for (let i = 0; i < numAncoras; i++) {
    let melhorClasse = -1;
    let melhorScore = confMin;
    for (let c = 0; c < numClasses; c++) {
      if (classesPermitidas && !classesPermitidas.has(c)) continue;
      const s = dados[(4 + c) * numAncoras + i];
      if (s >= melhorScore) {
        melhorScore = s;
        melhorClasse = c;
      }
    }
    if (melhorClasse < 0) continue;

    const cx = dados[i];
    const cy = dados[numAncoras + i];
    const w = dados[2 * numAncoras + i];
    const h = dados[3 * numAncoras + i];
    candidatas.push({
      classe: melhorClasse,
      confianca: melhorScore,
      caixa: desfazerLetterbox({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 }, lb),
    });
  }
  return nms(candidatas, iouNms).slice(0, maxDeteccoes);
}

/** Caixa em pixels do input (com letterbox) → normalizada no quadro original, limitada a 0..1. */
export function desfazerLetterbox(c: Caixa, lb: Letterbox): Caixa {
  const lim = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x1: lim((c.x1 - lb.padX) / lb.escala / lb.larguraOriginal),
    y1: lim((c.y1 - lb.padY) / lb.escala / lb.alturaOriginal),
    x2: lim((c.x2 - lb.padX) / lb.escala / lb.larguraOriginal),
    y2: lim((c.y2 - lb.padY) / lb.escala / lb.alturaOriginal),
  };
}
