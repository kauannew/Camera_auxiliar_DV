import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, mesclarConfig } from "../src/core/config";
import { FilaEnvio } from "../src/core/filaEnvio";
import { Orquestrador } from "../src/core/orquestrador";
import type { Dependencias } from "../src/core/orquestrador";
import type { ApiDeteccoes, ArmazenamentoFila, Posicao, ResultadoEnvio } from "../src/core/portas";
import type { RegistroDeteccao, DeteccaoBruta } from "../src/core/tipos";

// ---------------------------------------------------------------- dublês

class ArmazenamentoMemoria implements ArmazenamentoFila {
  itens = new Map<string, RegistroDeteccao>();
  async adicionar(r: RegistroDeteccao) {
    this.itens.set(r.id, r);
  }
  async listar(limite: number) {
    return [...this.itens.values()].slice(0, limite);
  }
  async remover(ids: string[]) {
    ids.forEach((id) => this.itens.delete(id));
  }
  async contar() {
    return this.itens.size;
  }
}

class ApiFalsa implements ApiDeteccoes {
  respostas: ResultadoEnvio[] = [];
  enviados: RegistroDeteccao[][] = [];
  async enviar(registros: RegistroDeteccao[]) {
    this.enviados.push(registros);
    return this.respostas.shift() ?? "ok";
  }
}

const esperarMicrotarefas = () => new Promise((r) => setTimeout(r, 0));

function criarDependencias(pos: Posicao | null) {
  const falas: { texto: string; urgente?: boolean }[] = [];
  const vibracoes: number[][] = [];
  const armazenamento = new ArmazenamentoMemoria();
  const api = new ApiFalsa();
  let agora = 0;
  let id = 0;
  const dep: Dependencias = {
    camera: { iniciar: async () => undefined, capturar: async () => null, parar: () => undefined },
    detector: {
      carregar: async () => "wasm",
      detectar: async () => ({ deteccoes: [], msInferencia: 0 }),
      classes: ["buraco", "person"],
      nomesFalados: ["buraco", "pessoa"],
    },
    voz: { falar: (texto, o) => falas.push({ texto, urgente: o?.urgente }), calar: () => undefined },
    haptico: { sinalizar: (p) => vibracoes.push(p), temVibracao: true },
    localizacao: { iniciar: async () => undefined, ultima: () => pos, parar: () => undefined },
    telaLigada: { ativar: async () => undefined, liberar: async () => undefined },
    armazenamento,
    api,
    relogio: {
      agora: () => agora,
      agoraIso: () => new Date(agora).toISOString(),
      esperar: () => new Promise(() => undefined), // o laço fica parado; os testes chamam processar()
      aCada: () => () => undefined,
    },
    geradorId: { novo: () => `id-${++id}` },
  };
  return { dep, falas, vibracoes, armazenamento, api, avancar: (ms: number) => (agora += ms) };
}

const buracoPerto: DeteccaoBruta = { caixa: { x1: 0.4, y1: 0.66, x2: 0.6, y2: 0.78 }, classe: 0, confianca: 0.82 };
const pessoaPerto: DeteccaoBruta = { ...buracoPerto, classe: 1 };
const posBoa: Posicao = { lat: -8.0631, lng: -34.8711, precisaoM: 8, timestampMs: 0 };

// ---------------------------------------------------------------- testes

describe("FilaEnvio", () => {
  it("mantém os registros quando a rede falha e envia depois", async () => {
    const arm = new ArmazenamentoMemoria();
    const api = new ApiFalsa();
    api.respostas = ["falha"];
    const fila = new FilaEnvio(arm, api, 50);
    const reg = { id: "a", classe: "buraco", lat: 0, lng: 0, precisao_gps: 5, confianca: 0.9, timestamp: "" };
    await fila.enfileirar(reg);
    await esperarMicrotarefas();
    expect(await arm.contar()).toBe(1);
    await fila.esvaziar();
    expect(await arm.contar()).toBe(0);
    expect(api.enviados).toHaveLength(2);
  });

  it("descarta lote rejeitado pelo servidor (4xx) para não travar a fila", async () => {
    const arm = new ArmazenamentoMemoria();
    const api = new ApiFalsa();
    api.respostas = ["rejeitado"];
    const fila = new FilaEnvio(arm, api, 50);
    await arm.adicionar({ id: "x", classe: "buraco", lat: 0, lng: 0, precisao_gps: null, confianca: 1, timestamp: "" });
    await fila.esvaziar();
    expect(await arm.contar()).toBe(0);
  });

  it("envia em lotes", async () => {
    const arm = new ArmazenamentoMemoria();
    const api = new ApiFalsa();
    for (let i = 0; i < 5; i++) {
      await arm.adicionar({ id: `r${i}`, classe: "buraco", lat: 0, lng: 0, precisao_gps: 1, confianca: 1, timestamp: "" });
    }
    await new FilaEnvio(arm, api, 2).esvaziar();
    expect(api.enviados.map((l) => l.length)).toEqual([2, 2, 1]);
  });
});

describe("Orquestrador", () => {
  it("buraco confirmado → vibra, fala e registra uma única vez com GPS", async () => {
    const t = criarDependencias(posBoa);
    const o = new Orquestrador(CONFIG_PADRAO, t.dep);
    await o.iniciar();
    t.falas.length = 0;

    for (let i = 0; i < 4; i++) {
      t.avancar(250);
      o.processar([buracoPerto], 50, 250 * (i + 1));
    }
    await esperarMicrotarefas();

    expect(t.falas.map((f) => f.texto)).toEqual(["Buraco à frente, perto"]);
    expect(t.falas[0].urgente).toBe(true);
    expect(t.vibracoes).toEqual([CONFIG_PADRAO.alertas.vibracao.perto]);
    expect(t.api.enviados.flat()).toHaveLength(1);
    expect(t.api.enviados[0][0]).toMatchObject({ classe: "buraco", lat: posBoa.lat, precisao_gps: 8, confianca: 0.82 });
    o.parar();
  });

  it("não registra com GPS impreciso, mas alerta normalmente", async () => {
    const t = criarDependencias({ ...posBoa, precisaoM: 120 });
    const o = new Orquestrador(CONFIG_PADRAO, t.dep);
    await o.iniciar();
    for (let i = 1; i <= 3; i++) o.processar([buracoPerto], 50, i * 250);
    await esperarMicrotarefas();
    expect(t.vibracoes).toHaveLength(1);
    expect(t.api.enviados).toHaveLength(0);
    o.parar();
  });

  it("classes fora do registro (ex.: pessoa do modelo provisório) alertam mas não vão ao mapa", async () => {
    const t = criarDependencias(posBoa);
    const o = new Orquestrador(CONFIG_PADRAO, t.dep);
    await o.iniciar();
    t.falas.length = 0;
    for (let i = 1; i <= 3; i++) o.processar([pessoaPerto], 50, i * 250);
    await esperarMicrotarefas();
    expect(t.falas.map((f) => f.texto)).toEqual(["Pessoa à frente, perto"]);
    expect(t.api.enviados).toHaveLength(0);
    o.parar();
  });

  it("classesAlvo filtra o que gera alerta", async () => {
    const t = criarDependencias(posBoa);
    const cfg = mesclarConfig(CONFIG_PADRAO, { modelo: { classesAlvo: ["buraco"] } });
    const o = new Orquestrador(cfg, t.dep);
    await o.iniciar();
    t.falas.length = 0;
    for (let i = 1; i <= 3; i++) o.processar([pessoaPerto], 50, i * 250);
    expect(t.falas).toHaveLength(0);
    o.parar();
  });

  it("câmera negada → mensagem falada clara e estado de erro", async () => {
    const t = criarDependencias(posBoa);
    const { ErroPlataforma } = await import("../src/core/portas");
    t.dep.camera.iniciar = async () => {
      throw new ErroPlataforma("permissao_negada", "NotAllowedError");
    };
    const o = new Orquestrador(CONFIG_PADRAO, t.dep);
    await o.iniciar();
    expect(o.estadoAtual).toBe("erro");
    expect(t.falas.at(-1)?.texto).toMatch(/câmera foi bloqueada/);
  });
});
