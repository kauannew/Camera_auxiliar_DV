// Sobreposição de calibração: desenha zonas, corredor, faixas de distância e caixas.

import type { Config } from "../core/config";
import type { InfoQuadro } from "../core/orquestrador";
import type { Proximidade } from "../core/tipos";

const COR_PROX: Record<Proximidade, string> = { perto: "#ff4d4d", medio: "#ff9f1a", longe: "#ffd400" };

export class SobreposicaoDebug {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
    private readonly cfg: Config,
    private readonly nomes: () => string[],
  ) {
    this.ctx = canvas.getContext("2d")!;
  }

  desenhar(info: InfoQuadro): void {
    const { canvas, ctx, cfg } = this;
    const w = (canvas.width = this.video.videoWidth || 640);
    const h = (canvas.height = this.video.videoHeight || 480);
    ctx.clearRect(0, 0, w, h);
    const linha = Math.max(2, Math.round(w / 200));
    ctx.font = `${Math.round(w / 28)}px system-ui, sans-serif`;

    // Corredor central (com e sem margem)
    const z = cfg.zonas;
    ctx.fillStyle = "rgba(61, 220, 132, 0.12)";
    ctx.fillRect((z.corredorInicio - z.corredorMargem) * w, 0, (z.corredorFim - z.corredorInicio + 2 * z.corredorMargem) * w, h);
    ctx.fillStyle = "rgba(61, 220, 132, 0.18)";
    ctx.fillRect(z.corredorInicio * w, 0, (z.corredorFim - z.corredorInicio) * w, h);

    // Fronteiras das zonas esquerda/centro/direita
    ctx.setLineDash([linha * 4, linha * 3]);
    ctx.lineWidth = linha;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    for (const x of [z.limiteEsquerda, z.limiteDireita]) {
      ctx.beginPath();
      ctx.moveTo(x * w, 0);
      ctx.lineTo(x * w, h);
      ctx.stroke();
    }

    // Faixas de distância (base da caixa abaixo da linha = mais perto)
    const d = cfg.distancia;
    for (const [y, rotulo, cor] of [
      [d.baseYPerto, "perto", COR_PROX.perto],
      [d.baseYMedio, "médio", COR_PROX.medio],
    ] as const) {
      ctx.strokeStyle = cor;
      ctx.beginPath();
      ctx.moveTo(0, y * h);
      ctx.lineTo(w, y * h);
      ctx.stroke();
      ctx.fillStyle = cor;
      ctx.fillText(rotulo, linha * 2, y * h - linha * 2);
    }
    ctx.setLineDash([]);

    // Caixas: cor = proximidade; borda grossa = obstáculo confirmado
    const confirmados = new Set(info.ativos.filter((r) => r.confirmado).map((r) => r.ultima));
    for (const det of info.deteccoes) {
      const { x1, y1, x2, y2 } = det.caixa;
      const cor = COR_PROX[det.proximidade];
      const confirmado = confirmados.has(det);
      ctx.strokeStyle = cor;
      ctx.lineWidth = confirmado ? linha * 3 : linha;
      if (!det.noCorredor) ctx.setLineDash([linha * 2, linha * 2]);
      ctx.strokeRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h);
      ctx.setLineDash([]);
      const texto = `${this.nomes()[det.classe] ?? det.classe} ${(det.confianca * 100).toFixed(0)}% ${det.proximidade}${confirmado ? " ✓" : ""}`;
      const tw = ctx.measureText(texto).width;
      const ty = Math.max(y1 * h, parseInt(ctx.font) + linha);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(x1 * w, ty - parseInt(ctx.font) - linha, tw + linha * 2, parseInt(ctx.font) + linha * 2);
      ctx.fillStyle = cor;
      ctx.fillText(texto, x1 * w + linha, ty - linha);
    }

    if (info.alerta) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, h - parseInt(ctx.font) * 1.8, w, parseInt(ctx.font) * 1.8);
      ctx.fillStyle = "#fff";
      ctx.fillText(`🔊 ${info.alerta.mensagem}`, linha * 2, h - parseInt(ctx.font) * 0.5);
    }
  }

  limpar(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
