// Câmera traseira via getUserMedia; cada quadro vira um ImageBitmap (transferível ao worker).

import { ErroPlataforma, type Camera, type Quadro } from "../../core/portas";

export class CameraWeb implements Camera {
  private stream: MediaStream | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  async iniciar(): Promise<void> {
    if (!window.isSecureContext) throw new ErroPlataforma("inseguro", "Câmera exige HTTPS");
    if (!navigator.mediaDevices?.getUserMedia) throw new ErroPlataforma("nao_suportado", "getUserMedia ausente");
    if (this.stream) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          // 640x480 basta: o modelo enxerga 320x320; resolução maior só gasta bateria
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 30 },
        },
      });
    } catch (e) {
      const nome = (e as DOMException).name;
      if (nome === "NotAllowedError" || nome === "SecurityError") throw new ErroPlataforma("permissao_negada", nome);
      throw new ErroPlataforma("indisponivel", nome);
    }
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
  }

  async capturar(): Promise<Quadro | null> {
    if (!this.stream || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || this.video.videoWidth === 0) {
      return null;
    }
    return createImageBitmap(this.video);
  }

  parar(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
