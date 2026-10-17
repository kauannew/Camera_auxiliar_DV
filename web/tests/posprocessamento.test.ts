import { describe, expect, it } from "vitest";
import { calcularLetterbox, decodificarYolo, iou, nms } from "../src/core/posprocessamento";

/** Monta uma saída [1, 4+nc, N] no layout do YOLO a partir de "âncoras" legíveis. */
function saidaYolo(nc: number, ancoras: { cx: number; cy: number; w: number; h: number; scores: number[] }[]) {
  const n = ancoras.length;
  const dados = new Float32Array((4 + nc) * n);
  ancoras.forEach((a, i) => {
    dados[i] = a.cx;
    dados[n + i] = a.cy;
    dados[2 * n + i] = a.w;
    dados[3 * n + i] = a.h;
    a.scores.forEach((s, c) => (dados[(4 + c) * n + i] = s));
  });
  return { dados, n };
}

describe("letterbox", () => {
  it("quadro retrato 480x640 em 320: escala 0,5 e faixas laterais", () => {
    const lb = calcularLetterbox(480, 640, 320);
    expect(lb.escala).toBe(0.5);
    expect(lb.padX).toBe(40);
    expect(lb.padY).toBe(0);
  });
});

describe("iou e nms", () => {
  it("iou de caixas iguais é 1 e de caixas disjuntas é 0", () => {
    const a = { x1: 0, y1: 0, x2: 1, y2: 1 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x1: 2, y1: 2, x2: 3, y2: 3 })).toBe(0);
  });

  it("nms remove a caixa sobreposta de menor confiança, só na mesma classe", () => {
    const caixa = { x1: 0, y1: 0, x2: 10, y2: 10 };
    const quase = { x1: 1, y1: 1, x2: 10, y2: 10 };
    const r = nms(
      [
        { caixa, classe: 0, confianca: 0.9 },
        { caixa: quase, classe: 0, confianca: 0.8 },
        { caixa: quase, classe: 1, confianca: 0.7 },
      ],
      0.45,
    );
    expect(r.map((d) => [d.classe, d.confianca])).toEqual([
      [0, 0.9],
      [1, 0.7],
    ]);
  });
});

describe("decodificarYolo", () => {
  const lb = calcularLetterbox(640, 640, 320); // escala 0,5, sem padding

  it("filtra por confiança, escolhe a melhor classe e normaliza", () => {
    const { dados, n } = saidaYolo(2, [
      { cx: 160, cy: 240, w: 64, h: 32, scores: [0.1, 0.9] },
      { cx: 50, cy: 50, w: 10, h: 10, scores: [0.2, 0.1] }, // abaixo do limiar
    ]);
    const r = decodificarYolo(dados, n, lb, { numClasses: 2, confMin: 0.4, iouNms: 0.45 });
    expect(r).toHaveLength(1);
    expect(r[0].classe).toBe(1);
    expect(r[0].confianca).toBeCloseTo(0.9);
    expect(r[0].caixa.x1).toBeCloseTo(128 / 320);
    expect(r[0].caixa.y2).toBeCloseTo(256 / 320);
  });

  it("desfaz o padding do letterbox em quadro retrato", () => {
    const lbRetrato = calcularLetterbox(480, 640, 320); // padX = 40
    const { dados, n } = saidaYolo(1, [{ cx: 160, cy: 160, w: 240, h: 320, scores: [0.8] }]);
    const [d] = decodificarYolo(dados, n, lbRetrato, { numClasses: 1, confMin: 0.4, iouNms: 0.45 });
    // a caixa ocupa exatamente a área útil (sem as faixas) → 0..1 no quadro original
    expect(d.caixa.x1).toBeCloseTo(0);
    expect(d.caixa.x2).toBeCloseTo(1);
    expect(d.caixa.y1).toBeCloseTo(0);
    expect(d.caixa.y2).toBeCloseTo(1);
  });

  it("respeita classesPermitidas", () => {
    const { dados, n } = saidaYolo(2, [{ cx: 100, cy: 100, w: 20, h: 20, scores: [0.95, 0.6] }]);
    const r = decodificarYolo(dados, n, lb, {
      numClasses: 2,
      confMin: 0.4,
      iouNms: 0.45,
      classesPermitidas: new Set([1]),
    });
    expect(r).toHaveLength(1);
    expect(r[0].classe).toBe(1);
  });
});
