// Rastreamento simples entre quadros + confirmação em N quadros.
// Objetivo: só alertar quando o mesmo obstáculo aparece de forma consistente,
// filtrando falsos positivos de um quadro só.

import type { Config } from "./config";
import { iou } from "./posprocessamento";
import type { Caixa, DeteccaoAnalisada, Rastro } from "./tipos";

function distanciaCentros(a: Caixa, b: Caixa): number {
  const dx = (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2;
  const dy = (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2;
  return Math.hypot(dx, dy);
}

export interface ResultadoRastreio {
  /** Rastros ativos (vistos recentemente). */
  ativos: Rastro[];
  /** Rastros que acabaram de ser confirmados neste quadro. */
  recemConfirmados: Rastro[];
}

export class Rastreador {
  private rastros: Rastro[] = [];
  private proximoId = 1;

  constructor(private readonly cfg: Config["confirmacao"]) {}

  atualizar(deteccoes: DeteccaoAnalisada[]): ResultadoRastreio {
    const recemConfirmados: Rastro[] = [];

    // 1. Pares candidatos (rastro, detecção) da mesma classe, do mais parecido ao menos
    const pares: { r: Rastro; d: number; nota: number }[] = [];
    for (const r of this.rastros) {
      deteccoes.forEach((det, d) => {
        if (det.classe !== r.classe) return;
        const sobreposicao = iou(r.ultima.caixa, det.caixa);
        const dist = distanciaCentros(r.ultima.caixa, det.caixa);
        if (sobreposicao >= this.cfg.iouAssociacao || dist <= this.cfg.distCentroAssociacao) {
          pares.push({ r, d, nota: sobreposicao - dist });
        }
      });
    }
    pares.sort((a, b) => b.nota - a.nota);

    // 2. Associação gulosa (cada rastro e cada detecção usados no máximo uma vez)
    const rastrosUsados = new Set<Rastro>();
    const deteccoesUsadas = new Set<number>();
    for (const { r, d } of pares) {
      if (rastrosUsados.has(r) || deteccoesUsadas.has(d)) continue;
      rastrosUsados.add(r);
      deteccoesUsadas.add(d);
      const det = deteccoes[d];
      r.ultima = det;
      r.quadrosVistos += 1;
      r.quadrosSemVer = 0;
      r.melhorConfianca = Math.max(r.melhorConfianca, det.confianca);
      const necessarios = det.proximidade === "perto" ? this.cfg.quadrosPerto : this.cfg.quadros;
      if (!r.confirmado && r.quadrosVistos >= necessarios) {
        r.confirmado = true;
        recemConfirmados.push(r);
      }
    }

    // 3. Rastros não vistos: tolera falhas curtas, depois zera a contagem e por fim esquece
    for (const r of this.rastros) {
      if (rastrosUsados.has(r)) continue;
      r.quadrosSemVer += 1;
      if (r.quadrosSemVer > this.cfg.toleranciaFalhas && !r.confirmado) r.quadrosVistos = 0;
    }
    // O rastro confirmado é mantido por alguns quadros para não realertar o mesmo obstáculo
    this.rastros = this.rastros.filter((r) => r.quadrosSemVer < this.cfg.quadrosParaEsquecer);

    // 4. Detecções novas viram rastros
    deteccoes.forEach((det, d) => {
      if (deteccoesUsadas.has(d)) return;
      const novo: Rastro = {
        id: this.proximoId++,
        classe: det.classe,
        ultima: det,
        quadrosVistos: 1,
        quadrosSemVer: 0,
        confirmado: false,
        melhorConfianca: det.confianca,
        ultimoAlertaMs: null,
        ultimaProximidadeAlertada: null,
        registrado: false,
      };
      // Com quadrosPerto = 1, um obstáculo muito perto pode confirmar de imediato
      const necessarios = det.proximidade === "perto" ? this.cfg.quadrosPerto : this.cfg.quadros;
      if (necessarios <= 1) {
        novo.confirmado = true;
        recemConfirmados.push(novo);
      }
      this.rastros.push(novo);
    });

    return { ativos: this.rastros.filter((r) => r.quadrosSemVer === 0), recemConfirmados };
  }

  limpar(): void {
    this.rastros = [];
  }

  get todos(): readonly Rastro[] {
    return this.rastros;
  }
}
