// Vigia (watchdog): para quem não enxerga, silêncio não pode significar
// "caminho livre" quando, na verdade, a detecção travou. Se nenhum quadro for
// processado por um tempo, avisa; quando volta, avisa também.

export type TransicaoVigia = "travou" | "voltou" | null;

export class Vigia {
  private ultimoQuadroMs: number | null = null;
  private travado = false;

  constructor(private readonly limiteMs: number) {}

  /** Chamar a cada quadro processado com sucesso. */
  quadroProcessado(agoraMs: number): TransicaoVigia {
    this.ultimoQuadroMs = agoraMs;
    if (this.travado) {
      this.travado = false;
      return "voltou";
    }
    return null;
  }

  /** Chamar periodicamente (ex.: a cada 1 s). */
  verificar(agoraMs: number): TransicaoVigia {
    if (this.ultimoQuadroMs === null || this.travado) return null;
    if (agoraMs - this.ultimoQuadroMs > this.limiteMs) {
      this.travado = true;
      return "travou";
    }
    return null;
  }

  /** Recomeça a contagem (ao iniciar ou retomar o monitoramento). */
  reiniciar(agoraMs: number): void {
    this.ultimoQuadroMs = agoraMs;
    this.travado = false;
  }
}
