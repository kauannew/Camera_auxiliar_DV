import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO as cfg } from "../src/core/config";
import { analisar } from "../src/core/heuristica";
import { Priorizador } from "../src/core/priorizador";
import { Rastreador } from "../src/core/rastreador";
import type { DeteccaoAnalisada } from "../src/core/tipos";
import { Vigia } from "../src/core/vigia";

const det = (x1: number, y1: number, x2: number, y2: number, classe = 0, confianca = 0.8): DeteccaoAnalisada =>
  analisar({ caixa: { x1, y1, x2, y2 }, classe, confianca }, cfg);

// buraco no centro, a média distância (base em 0,5)
const medio = () => det(0.42, 0.44, 0.58, 0.5);
// o mesmo buraco mais perto (base em 0,70)
const perto = () => det(0.4, 0.62, 0.6, 0.7);
// passo intermediário (ainda médio), como entre dois quadros reais a 4 FPS
const chegando = () => det(0.41, 0.55, 0.59, 0.62);

describe("Rastreador", () => {
  it("só confirma depois de N quadros seguidos", () => {
    const r = new Rastreador(cfg.confirmacao);
    expect(r.atualizar([medio()]).recemConfirmados).toHaveLength(0);
    expect(r.atualizar([medio()]).recemConfirmados).toHaveLength(0);
    const t3 = r.atualizar([medio()]);
    expect(t3.recemConfirmados).toHaveLength(1);
    expect(t3.ativos[0].confirmado).toBe(true);
  });

  it("perto confirma mais rápido (2 quadros)", () => {
    const r = new Rastreador(cfg.confirmacao);
    r.atualizar([perto()]);
    expect(r.atualizar([perto()]).recemConfirmados).toHaveLength(1);
  });

  it("tolera uma falha, mas zera com falhas seguidas", () => {
    const r = new Rastreador(cfg.confirmacao);
    r.atualizar([medio()]);
    r.atualizar([medio()]);
    r.atualizar([]); // 1 falha: tolerada
    expect(r.atualizar([medio()]).recemConfirmados).toHaveLength(1);

    const r2 = new Rastreador(cfg.confirmacao);
    r2.atualizar([medio()]);
    r2.atualizar([medio()]);
    r2.atualizar([]);
    r2.atualizar([]); // 2 falhas: zera
    expect(r2.atualizar([medio()]).recemConfirmados).toHaveLength(0);
  });

  it("um falso positivo de um quadro nunca confirma", () => {
    const r = new Rastreador(cfg.confirmacao);
    r.atualizar([medio()]);
    for (let i = 0; i < 5; i++) expect(r.atualizar([]).recemConfirmados).toHaveLength(0);
    expect(r.todos).toHaveLength(0);
  });

  it("acompanha o obstáculo que se aproxima (caixa desce e cresce)", () => {
    const r = new Rastreador(cfg.confirmacao);
    r.atualizar([det(0.44, 0.4, 0.56, 0.45)]);
    r.atualizar([det(0.43, 0.46, 0.57, 0.52)]);
    const t = r.atualizar([det(0.42, 0.52, 0.58, 0.6)]);
    expect(t.ativos).toHaveLength(1);
    expect(t.ativos[0].id).toBe(1);
  });
});

describe("Priorizador", () => {
  const nomes = () => "buraco";

  function confirmado(r: Rastreador, d: () => DeteccaoAnalisada) {
    let ativos = r.atualizar([d()]).ativos;
    for (let i = 0; i < 3; i++) ativos = r.atualizar([d()]).ativos;
    return ativos;
  }

  it("alerta uma vez e respeita o cooldown do obstáculo", () => {
    const r = new Rastreador(cfg.confirmacao);
    const p = new Priorizador(cfg.alertas, nomes);
    const ativos = confirmado(r, medio);
    const a = p.escolher(ativos, 0);
    expect(a?.mensagem).toBe("Buraco à frente, a poucos passos");
    expect(a?.padraoVibracao).toEqual(cfg.alertas.vibracao.medio);
    expect(p.escolher(ativos, 3000)).toBeNull();
    expect(p.escolher(ativos, cfg.alertas.cooldownObstaculoMs + 1)).not.toBeNull();
  });

  it("realerta antes do cooldown quando o obstáculo fica mais perto, como urgente", () => {
    const r = new Rastreador(cfg.confirmacao);
    const p = new Priorizador(cfg.alertas, nomes);
    p.escolher(confirmado(r, medio), 0);
    r.atualizar([chegando()]);
    const ativos = r.atualizar([perto()]).ativos;
    const a = p.escolher(ativos, 1000); // dentro do intervalo entre falas, mas urgente
    expect(a?.proximidade).toBe("perto");
    expect(a?.urgente).toBe(true);
    expect(a?.padraoVibracao).toEqual(cfg.alertas.vibracao.perto);
  });

  it("obstáculo longe no corredor não alerta; lateral perto alerta só por voz", () => {
    const r = new Rastreador(cfg.confirmacao);
    const p = new Priorizador(cfg.alertas, nomes);
    expect(p.escolher(confirmado(r, () => det(0.45, 0.2, 0.55, 0.25)), 0)).toBeNull();

    const r2 = new Rastreador(cfg.confirmacao);
    const lateral = p.escolher(confirmado(r2, () => det(0.82, 0.7, 0.98, 0.85)), 10_000);
    expect(lateral?.intensidade).toBe("fraco");
    expect(lateral?.padraoVibracao).toBeNull();
    expect(lateral?.mensagem).toBe("Buraco ao lado, perto, à direita");
  });

  it("com vários obstáculos, escolhe o mais perto", () => {
    const r = new Rastreador(cfg.confirmacao);
    const p = new Priorizador(cfg.alertas, nomes);
    const medioLado = () => det(0.05, 0.44, 0.33, 0.5);
    const pertoCentro = () => det(0.45, 0.68, 0.55, 0.75);
    let ativos = r.atualizar([medioLado(), pertoCentro()]).ativos;
    for (let i = 0; i < 3; i++) ativos = r.atualizar([medioLado(), pertoCentro()]).ativos;
    expect(p.escolher(ativos, 0)?.proximidade).toBe("perto");
  });
});

describe("Vigia", () => {
  it("avisa quando trava e quando volta, uma vez cada", () => {
    const v = new Vigia(3000);
    v.reiniciar(0);
    expect(v.verificar(2000)).toBeNull();
    expect(v.verificar(3500)).toBe("travou");
    expect(v.verificar(5000)).toBeNull();
    expect(v.quadroProcessado(6000)).toBe("voltou");
    expect(v.quadroProcessado(6250)).toBeNull();
  });
});
