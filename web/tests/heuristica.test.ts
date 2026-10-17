import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO as cfg } from "../src/core/config";
import { analisar, proximidadeDe, tocaCorredor, zonaDe } from "../src/core/heuristica";
import { mensagemAlerta } from "../src/core/mensagens";

const caixa = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });

describe("zonas e corredor", () => {
  it("classifica pela posição do centro", () => {
    expect(zonaDe(caixa(0.0, 0.5, 0.2, 0.6), cfg.zonas)).toBe("esquerda");
    expect(zonaDe(caixa(0.4, 0.5, 0.6, 0.6), cfg.zonas)).toBe("centro");
    expect(zonaDe(caixa(0.8, 0.5, 1.0, 0.6), cfg.zonas)).toBe("direita");
  });

  it("caixa à esquerda que invade o corredor conta como à frente", () => {
    const c = caixa(0.05, 0.6, 0.3, 0.8); // centro em 0,175 (esquerda), borda em 0,30
    expect(zonaDe(c, cfg.zonas)).toBe("esquerda");
    expect(tocaCorredor(c, cfg.zonas)).toBe(true);
  });

  it("caixa totalmente na lateral fica fora do corredor", () => {
    expect(tocaCorredor(caixa(0.0, 0.6, 0.2, 0.8), cfg.zonas)).toBe(false);
    expect(tocaCorredor(caixa(0.8, 0.6, 1.0, 0.8), cfg.zonas)).toBe(false);
  });
});

describe("proximidade", () => {
  it("usa a base da caixa: mais baixa = mais perto", () => {
    expect(proximidadeDe(caixa(0.45, 0.7, 0.55, 0.75), cfg.distancia)).toBe("perto");
    expect(proximidadeDe(caixa(0.45, 0.45, 0.55, 0.5), cfg.distancia)).toBe("medio");
    expect(proximidadeDe(caixa(0.45, 0.2, 0.55, 0.25), cfg.distancia)).toBe("longe");
  });

  it("área grande promove para perto mesmo com a base alta", () => {
    expect(proximidadeDe(caixa(0.2, 0.0, 0.6, 0.4), cfg.distancia)).toBe("perto"); // área 0,16
  });

  it("área média promove longe para médio", () => {
    expect(proximidadeDe(caixa(0.3, 0.2, 0.5, 0.4), cfg.distancia)).toBe("medio"); // área 0,04
  });
});

describe("analisar + mensagem", () => {
  it("gera o texto no formato combinado", () => {
    const d = analisar({ caixa: caixa(0.25, 0.7, 0.45, 0.85), classe: 0, confianca: 0.8 }, cfg);
    expect(d).toMatchObject({ zona: "esquerda", noCorredor: true, proximidade: "perto" });
    expect(mensagemAlerta("buraco", d.noCorredor, d.proximidade, d.zona)).toBe("Buraco à frente, perto, à esquerda");
  });

  it("centro não fala o lado; lateral fala 'ao lado'", () => {
    expect(mensagemAlerta("buraco", true, "medio", "centro")).toBe("Buraco à frente, a poucos passos");
    expect(mensagemAlerta("buraco", false, "perto", "direita")).toBe("Buraco ao lado, perto, à direita");
  });
});
