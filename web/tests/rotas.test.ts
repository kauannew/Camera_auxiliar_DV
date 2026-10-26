import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroRota, ROTA_DEMO, buscarRota, converterResposta, mensagemDeErro, urlRota } from "../src/interface/rotas/apiRotas";
import {
  distanciaCurta,
  distanciaFalada,
  duracaoFalada,
  resumoFalado,
  textoFaladoDoPasso,
} from "../src/interface/rotas/formatadores";

// Trecho de uma resposta real da API (formato conferido em 26/10/2026)
const RESPOSTA = {
  distanciaMetros: 639,
  duracaoSegundos: 460,
  geometria: {
    type: "LineString",
    coordinates: [
      [-38.512313, -12.973797],
      [-38.512331, -12.97387],
      [-38.508312, -12.971295],
    ],
  },
  instrucoes: [
    { texto: "Siga para sul em direção a Ladeira da Misericórdia", distanciaMetros: 51 },
    { texto: "Vire à esquerda", distanciaMetros: 56 },
    { texto: "Chegar a Rua das Portas do Carmo, à direita", distanciaMetros: 0 },
  ],
  obstaculosEvitados: 1,
  desvioPossivel: true,
  motor: "salvador",
};

afterEach(() => vi.unstubAllGlobals());

describe("urlRota", () => {
  it("monta origem e destino como lat,lon", () => {
    const url = urlRota(ROTA_DEMO.origem, ROTA_DEMO.destino, "https://x.test");
    expect(url).toBe("https://x.test/api/rota?origem=-12.9738,-38.5123&destino=-12.9713,-38.5083");
  });
});

describe("converterResposta", () => {
  it("converte uma resposta válida", () => {
    const rota = converterResposta(RESPOSTA);
    expect(rota.distanciaM).toBe(639);
    expect(rota.passos).toHaveLength(3);
    expect(rota.passos[1]).toEqual({ texto: "Vire à esquerda", distanciaM: 56 });
    expect(rota.obstaculosEvitados).toBe(1);
    expect(rota.geometria.coordinates[0]).toEqual([-38.512313, -12.973797]);
  });

  it("trata desvioPossivel=false como erro legível", () => {
    expect(() => converterResposta({ ...RESPOSTA, desvioPossivel: false })).toThrow(/rota acessível/);
  });

  it("repassa a mensagem de { erro }", () => {
    expect(() => converterResposta({ erro: "Origem fora da área" })).toThrow("Origem fora da área");
  });

  it("rejeita geometria inválida", () => {
    expect(() => converterResposta({ ...RESPOSTA, geometria: { type: "Point", coordinates: [0, 0] } })).toThrow(ErroRota);
    expect(() => converterResposta({ ...RESPOSTA, geometria: { type: "LineString", coordinates: [[1, 2]] } })).toThrow(ErroRota);
    expect(() => converterResposta(null)).toThrow(ErroRota);
  });

  it("ignora instruções malformadas", () => {
    const rota = converterResposta({ ...RESPOSTA, instrucoes: [{ texto: "" }, { distanciaMetros: 3 }, { texto: "Siga" }] });
    expect(rota.passos).toEqual([{ texto: "Siga", distanciaM: 0 }]);
  });
});

describe("buscarRota", () => {
  it("faz o GET e devolve a rota", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => RESPOSTA });
    vi.stubGlobal("fetch", fetchMock);
    const rota = await buscarRota(ROTA_DEMO.origem, ROTA_DEMO.destino);
    expect(rota.motor).toBe("salvador");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/rota?origem=-12.9738,-38.5123&destino=-12.9713,-38.5083");
  });

  it("transforma erro HTTP em ErroRota com o detalhe da API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ erro: "coordenada inválida" }) }));
    await expect(buscarRota(ROTA_DEMO.origem, ROTA_DEMO.destino)).rejects.toThrow(/400.*coordenada inválida/);
  });

  it("sobrevive a corpo não-JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => Promise.reject(new SyntaxError()) }));
    await expect(buscarRota(ROTA_DEMO.origem, ROTA_DEMO.destino)).rejects.toThrow(/403/);
  });
});

describe("mensagemDeErro", () => {
  it("distingue falta de rede, tempo esgotado e erro conhecido", () => {
    expect(mensagemDeErro(new TypeError("Failed to fetch"))).toMatch(/Sem conexão/);
    expect(mensagemDeErro(new DOMException("t", "TimeoutError"))).toMatch(/demorou/);
    expect(mensagemDeErro(new ErroRota("X"))).toBe("X");
    expect(mensagemDeErro("???")).toMatch(/Não foi possível/);
  });
});

describe("formatadores", () => {
  it("distâncias", () => {
    expect(distanciaCurta(56)).toBe("56 m");
    expect(distanciaCurta(1250)).toBe("1,3 km");
    expect(distanciaFalada(1)).toBe("1 metro");
    expect(distanciaFalada(51)).toBe("51 metros");
    expect(distanciaFalada(1000)).toBe("1 quilômetro");
  });

  it("durações", () => {
    expect(duracaoFalada(20)).toBe("menos de 1 minuto");
    expect(duracaoFalada(460)).toBe("8 minutos");
    expect(duracaoFalada(60)).toBe("1 minuto");
    expect(duracaoFalada(3900)).toBe("1 hora e 5 minutos");
  });

  it("textos falados", () => {
    expect(textoFaladoDoPasso({ texto: "Vire à esquerda", distanciaM: 56 })).toBe("Vire à esquerda, por 56 metros.");
    expect(textoFaladoDoPasso({ texto: "Chegar ao destino", distanciaM: 0 })).toBe("Chegar ao destino.");
    expect(resumoFalado(converterResposta(RESPOSTA))).toBe(
      "Rota calculada: 639 metros, cerca de 8 minutos. 3 passos. 1 obstáculo evitado.",
    );
  });
});
