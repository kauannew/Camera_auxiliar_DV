// Vibração (Vibration API) com alternativa sonora: no Safari/iOS não existe
// navigator.vibrate, então o mesmo padrão vira bipes (quanto mais perto, mais rápidos).

import type { Haptico } from "../../core/portas";

export class HapticoWeb implements Haptico {
  readonly temVibracao = typeof navigator.vibrate === "function";
  private audio: AudioContext | null = null;

  /** Cria/retoma o AudioContext; chamar dentro de um gesto do usuário (clique em Iniciar). */
  destravar(): void {
    if (this.temVibracao) return;
    this.audio ??= new AudioContext();
    void this.audio.resume();
  }

  sinalizar(padrao: number[]): void {
    if (this.temVibracao) {
      navigator.vibrate(padrao);
      return;
    }
    this.bipes(padrao);
  }

  /** Toca o padrão [ligado, desligado, ligado, ...] como bipes de 880 Hz. */
  private bipes(padrao: number[]): void {
    if (!this.audio) return;
    let t = this.audio.currentTime;
    padrao.forEach((ms, i) => {
      const dur = ms / 1000;
      if (i % 2 === 0) {
        const osc = this.audio!.createOscillator();
        const ganho = this.audio!.createGain();
        osc.frequency.value = 880;
        ganho.gain.setValueAtTime(0.25, t);
        ganho.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(ganho).connect(this.audio!.destination);
        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur;
    });
  }
}
