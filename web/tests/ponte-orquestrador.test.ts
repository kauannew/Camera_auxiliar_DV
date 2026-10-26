import { describe, expect, it, vi } from "vitest";
import { PonteOrquestrador } from "../src/interface/camera/ponteOrquestrador";
import type { Alerta } from "../src/core/tipos";
import type { Configuracoes } from "../src/interface/useSentinela";

describe("PonteOrquestrador", () => {
  const configPadrao: Configuracoes = {
    voz: true,
    bipes: true,
    vibracao: true,
    distanciaAvisoM: 1.5,
    modo: "real",
  };

  it("inicializa com estado parado e métricas zeradas", () => {
    const ponte = new PonteOrquestrador(() => configPadrao, {
      aoMudarEstado: vi.fn(),
      aoDetectarAlerta: vi.fn(),
      aoCaminhoLivre: vi.fn(),
    });

    expect(ponte.estaAtivo).toBe(false);
    expect(ponte.estadoAtual).toBe("parado");
  });

  it("informa erro caso o elemento de vídeo não tenha sido conectado", async () => {
    const aoMudarEstado = vi.fn();
    const ponte = new PonteOrquestrador(() => configPadrao, {
      aoMudarEstado,
      aoDetectarAlerta: vi.fn(),
      aoCaminhoLivre: vi.fn(),
    });

    await ponte.iniciar();
    expect(aoMudarEstado).toHaveBeenCalledWith("erro", expect.stringMatching(/vídeo/i));
  });

  it("mapeia alertas de proximidade perto para Cenario de perigo imediato", () => {
    const aoDetectarAlerta = vi.fn();
    const ponte = new PonteOrquestrador(() => configPadrao, {
      aoMudarEstado: vi.fn(),
      aoDetectarAlerta,
      aoCaminhoLivre: vi.fn(),
    });

    const alertaPerto: Alerta = {
      rastroId: 1,
      classe: 0,
      intensidade: "forte",
      proximidade: "perto",
      zona: "centro",
      noCorredor: true,
      mensagem: "Buraco à frente, perto",
      padraoVibracao: [300, 100, 300],
      prioridade: 1,
      urgente: true,
    };

    // Acessa método de mapeamento interno para validar conversão fiel
    // @ts-expect-error testando método privado
    const cenario = ponte.alertaParaCenario(alertaPerto);

    expect(cenario.perigo).toBe(true);
    expect(cenario.titulo).toBe("Obstáculo Perto!");
    expect(cenario.descricao).toBe("Buraco à frente, perto");
    expect(cenario.meta).toContain("Menos de 1,5 metro");
    expect(cenario.meta).toContain("Centro");
  });

  it("mapeia alertas laterais com a indicação correta de direção", () => {
    const ponte = new PonteOrquestrador(() => configPadrao, {
      aoMudarEstado: vi.fn(),
      aoDetectarAlerta: vi.fn(),
      aoCaminhoLivre: vi.fn(),
    });

    const alertaLateral: Alerta = {
      rastroId: 2,
      classe: 1,
      intensidade: "fraco",
      proximidade: "medio",
      zona: "esquerda",
      noCorredor: false,
      mensagem: "Poste ao lado, a poucos passos, à esquerda",
      padraoVibracao: [200, 100],
      prioridade: 2,
      urgente: false,
    };

    // @ts-expect-error testando método privado
    const cenario = ponte.alertaParaCenario(alertaLateral);

    expect(cenario.perigo).toBe(true);
    expect(cenario.titulo).toBe("Obstáculo à Frente!");
    expect(cenario.meta).toContain("À esquerda");
    expect(cenario.meta).toContain("2 a 3 metros");
  });
});
