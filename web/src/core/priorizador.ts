// Decide QUAL alerta emitir agora (no máximo um por vez) e QUANDO.
// Princípio: o app é complemento da bengala, então menos ruído vale mais que
// mais alertas. Um só alerta por vez; o mais próximo e central tem prioridade.

import type { Config } from "./config";
import { ORDEM_PROXIMIDADE } from "./heuristica";
import { mensagemAlerta } from "./mensagens";
import type { Alerta, Intensidade, Rastro } from "./tipos";

export class Priorizador {
  private ultimaFalaMs: number | null = null;
  private ultimaPrioridade = 0;

  constructor(
    private readonly cfg: Config["alertas"],
    private readonly nomeFalado: (classe: number) => string,
  ) {}

  /** Intensidade do alerta para um rastro, ou null se ele não deve alertar. */
  private intensidade(r: Rastro): Intensidade | null {
    const { noCorredor, proximidade } = r.ultima;
    if (noCorredor) {
      if (proximidade === "longe" && !this.cfg.avisarLonge) return null;
      return proximidade === "longe" ? "fraco" : "forte";
    }
    if (proximidade === "perto" && this.cfg.avisarLateralPerto) return "fraco";
    return null;
  }

  private elegivel(r: Rastro, agoraMs: number): boolean {
    if (r.ultimoAlertaMs === null) return true;
    if (agoraMs - r.ultimoAlertaMs >= this.cfg.cooldownObstaculoMs) return true;
    // Ficou mais perto desde o último aviso → avisa de novo, sem esperar o cooldown
    return (
      this.cfg.realertarAoAproximar &&
      r.ultimaProximidadeAlertada !== null &&
      ORDEM_PROXIMIDADE[r.ultima.proximidade] > ORDEM_PROXIMIDADE[r.ultimaProximidadeAlertada]
    );
  }

  /**
   * Recebe os rastros ativos e devolve o alerta a emitir agora (ou null).
   * Marca o rastro escolhido como alertado.
   */
  escolher(ativos: Rastro[], agoraMs: number): Alerta | null {
    let melhor: { r: Rastro; intensidade: Intensidade; prioridade: number } | null = null;
    for (const r of ativos) {
      if (!r.confirmado || !this.elegivel(r, agoraMs)) continue;
      const intensidade = this.intensidade(r);
      if (!intensidade) continue;
      const prioridade =
        ORDEM_PROXIMIDADE[r.ultima.proximidade] * 10 + (intensidade === "forte" ? 5 : 0) + r.ultima.confianca;
      if (!melhor || prioridade > melhor.prioridade) melhor = { r, intensidade, prioridade };
    }
    if (!melhor) return null;

    const { r, intensidade, prioridade } = melhor;
    const urgente = intensidade === "forte" && r.ultima.proximidade === "perto";
    const emIntervalo = this.ultimaFalaMs !== null && agoraMs - this.ultimaFalaMs < this.cfg.intervaloEntreFalasMs;
    // Dentro do intervalo entre falas, só passa algo URGENTE e mais importante que a fala anterior
    if (emIntervalo && !(urgente && prioridade > this.ultimaPrioridade)) return null;

    r.ultimoAlertaMs = agoraMs;
    r.ultimaProximidadeAlertada = r.ultima.proximidade;
    this.ultimaFalaMs = agoraMs;
    this.ultimaPrioridade = prioridade;

    return {
      rastroId: r.id,
      classe: r.classe,
      intensidade,
      proximidade: r.ultima.proximidade,
      zona: r.ultima.zona,
      noCorredor: r.ultima.noCorredor,
      mensagem: mensagemAlerta(this.nomeFalado(r.classe), r.ultima.noCorredor, r.ultima.proximidade, r.ultima.zona),
      // Vibração só nos alertas fortes (corredor); laterais são só falados
      padraoVibracao: intensidade === "forte" ? this.cfg.vibracao[r.ultima.proximidade] : null,
      prioridade,
      urgente,
    };
  }

  reiniciar(): void {
    this.ultimaFalaMs = null;
    this.ultimaPrioridade = 0;
  }
}
