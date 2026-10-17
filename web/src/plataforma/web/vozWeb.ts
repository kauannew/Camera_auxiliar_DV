// Voz em pt-BR com speechSynthesis.

import type { Voz } from "../../core/portas";

export class VozWeb implements Voz {
  private voz: SpeechSynthesisVoice | null = null;
  private readonly disponivel = "speechSynthesis" in window;

  constructor(private readonly velocidade = 1.15) {
    if (!this.disponivel) return;
    const escolher = () => {
      const vozes = speechSynthesis.getVoices();
      this.voz =
        vozes.find((v) => v.lang === "pt-BR" && v.localService) ??
        vozes.find((v) => v.lang === "pt-BR") ??
        vozes.find((v) => v.lang.startsWith("pt")) ??
        null;
    };
    escolher();
    speechSynthesis.addEventListener("voiceschanged", escolher);
  }

  /**
   * iOS/Safari só libera a síntese de voz dentro de um gesto do usuário.
   * Chamar no clique do botão Iniciar.
   */
  destravar(): void {
    if (!this.disponivel) return;
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  falar(texto: string, opcoes?: { urgente?: boolean }): void {
    if (!this.disponivel) return;
    if (opcoes?.urgente) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    if (this.voz) u.voice = this.voz;
    u.rate = this.velocidade;
    speechSynthesis.speak(u);
  }

  calar(): void {
    if (this.disponivel) speechSynthesis.cancel();
  }
}
