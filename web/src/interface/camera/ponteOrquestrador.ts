// Ponte entre o Orquestrador da Câmera (motor em TypeScript puro) e a interface React.
// Gerencia a câmera real via getUserMedia, inferência no Web Worker e mapeia
// os eventos de detecção para o formato `Cenario` consumido pelos componentes visuais.

import { CONFIG_PADRAO, mesclarConfig, type Config } from "../../core/config";
import { Orquestrador, type EstadoMonitor, type InfoQuadro } from "../../core/orquestrador";
import type { Haptico, Voz } from "../../core/portas";
import type { Alerta } from "../../core/tipos";
import { CameraWeb } from "../../plataforma/web/cameraWeb";
import { DetectorWorker } from "../../plataforma/web/detectorWorker";
import {
  ApiHttp,
  ArmazenamentoIndexedDB,
  LocalizacaoWeb,
  TelaLigadaWeb,
  geradorIdWeb,
  relogioWeb,
} from "../../plataforma/web/diversosWeb";
import type { Cenario } from "../cenarios";
import { falar, pararFala, tocarBipe, vibrar } from "../feedback";
import type { Configuracoes } from "../useSentinela";

export interface MetricasQuadro {
  fps: number;
  msInferencia: number;
  backend: string;
  pendentes: number;
  ultimoAlerta: string;
}

export interface CallbacksPonte {
  aoMudarEstado: (estado: EstadoMonitor, mensagem: string) => void;
  aoDetectarAlerta: (cenario: Cenario) => void;
  aoCaminhoLivre: () => void;
  aoAtualizarMetricas?: (metricas: MetricasQuadro) => void;
}

/** Ajusta os limiares de distância de acordo com a preferência do usuário (1.5 m, 2 m ou 3 m). */
function ajustarLimiaresDistancia(distanciaM: number) {
  if (distanciaM >= 3) {
    return { baseYPerto: 0.42, baseYMedio: 0.3 };
  }
  if (distanciaM >= 2) {
    return { baseYPerto: 0.54, baseYMedio: 0.36 };
  }
  return { baseYPerto: 0.68, baseYMedio: 0.42 };
}

export class PonteOrquestrador {
  private orquestrador: Orquestrador | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private backend = "—";
  private pendentes = 0;
  private ultimoAlertaTexto = "—";
  private emAlerta = false;
  private ultimoAlertaTimestamp = 0;
  private timerRetornoLivre: number | undefined = undefined;

  constructor(
    private readonly obterConfig: () => Configuracoes,
    private readonly callbacks: CallbacksPonte,
  ) {}

  /** Conecta o elemento de vídeo (invisível na tela) necessário para a captura. */
  conectarVideo(video: HTMLVideoElement | null): void {
    this.videoEl = video;
  }

  get estaAtivo(): boolean {
    return this.orquestrador?.estadoAtual === "ativo" || this.orquestrador?.estadoAtual === "iniciando";
  }

  get estadoAtual(): EstadoMonitor {
    return this.orquestrador?.estadoAtual ?? "parado";
  }

  private montarConfig(distanciaM: number): Config {
    const params = new URLSearchParams(window.location.search);
    const modelo = params.get("modelo");
    const limiares = ajustarLimiaresDistancia(distanciaM);

    return mesclarConfig(CONFIG_PADRAO, {
      distancia: limiares,
      ...(modelo ? { modelo: { url: `/modelos/${modelo}.onnx`, rotulos: `/modelos/${modelo}.labels.json` } } : {}),
      ...(params.get("registrarTodas") ? { registro: { classes: "todas" as const } } : {}),
      ...(params.get("fps") ? { captura: { fpsAlvo: Number(params.get("fps")) } } : {}),
    });
  }

  private criarDependencias(cfg: Config, video: HTMLVideoElement) {
    const params = new URLSearchParams(window.location.search);
    const forcarBackend = (["wasm", "webgpu"] as const).find((b) => b === params.get("backend"));

    // Adaptador de voz que respeita as configurações e interrompe áudios de rota quando surge perigo
    const voz: Voz = {
      falar: (texto: string) => {
        const cfgAtual = this.obterConfig();
        if (cfgAtual.voz) falar(texto);
      },
      calar: () => {
        pararFala();
      },
    };

    // Adaptador háptico que respeita a configuração de vibração e emite bipe quando configurado
    const haptico: Haptico = {
      temVibracao: typeof navigator.vibrate === "function",
      sinalizar: (padrao: number[]) => {
        const cfgAtual = this.obterConfig();
        if (cfgAtual.vibracao) vibrar(padrao);
        if (cfgAtual.bipes) tocarBipe(true);
      },
    };

    return {
      camera: new CameraWeb(video),
      detector: new DetectorWorker(cfg.modelo, forcarBackend),
      voz,
      haptico,
      localizacao: new LocalizacaoWeb(),
      telaLigada: new TelaLigadaWeb(),
      armazenamento: new ArmazenamentoIndexedDB(),
      api: new ApiHttp(),
      relogio: relogioWeb,
      geradorId: geradorIdWeb,
    };
  }

  private tratarQuadro(info: InfoQuadro): void {
    if (info.alerta) {
      this.ultimoAlertaTexto = info.alerta.mensagem;
      this.ultimoAlertaTimestamp = Date.now();
      this.emAlerta = true;
      window.clearTimeout(this.timerRetornoLivre);

      const cenario = this.alertaParaCenario(info.alerta);
      this.callbacks.aoDetectarAlerta(cenario);
    } else if (this.emAlerta) {
      // Verifica se ainda há algum rastro confirmado dentro do corredor central
      const temObstaculoNoCorredor = info.ativos.some((r) => r.confirmado && r.ultima.noCorredor);
      const tempoDecorrido = Date.now() - this.ultimoAlertaTimestamp;

      if (!temObstaculoNoCorredor && tempoDecorrido > 2200) {
        this.emAlerta = false;
        this.callbacks.aoCaminhoLivre();
      }
    }

    this.callbacks.aoAtualizarMetricas?.({
      fps: info.fps,
      msInferencia: info.msInferencia,
      backend: this.backend,
      pendentes: this.pendentes,
      ultimoAlerta: this.ultimoAlertaTexto,
    });
  }

  private alertaParaCenario(alerta: Alerta): Cenario {
    const ehPerto = alerta.proximidade === "perto";
    const lado = alerta.zona === "centro" ? "Centro" : alerta.zona === "esquerda" ? "À esquerda" : "À direita";
    const distanciaTexto = ehPerto ? "Menos de 1,5 metro" : "Cerca de 2 a 3 metros";

    return {
      perigo: true,
      icone: "!",
      titulo: ehPerto ? "Obstáculo Perto!" : "Obstáculo à Frente!",
      descricao: alerta.mensagem,
      meta: `Distância: ${distanciaTexto} • ${lado}`,
      fala: alerta.mensagem,
      vibracao: alerta.padraoVibracao ?? (ehPerto ? [300, 100, 300] : [200, 100]),
    };
  }

  async iniciar(): Promise<void> {
    if (!this.videoEl) {
      this.callbacks.aoMudarEstado("erro", "Elemento de vídeo não inicializado.");
      return;
    }

    const cfgAtual = this.obterConfig();
    const config = this.montarConfig(cfgAtual.distanciaAvisoM);
    const dep = this.criarDependencias(config, this.videoEl);

    this.orquestrador = new Orquestrador(config, dep, {
      aoMudarEstado: (estado, msg) => {
        this.callbacks.aoMudarEstado(estado, msg);
      },
      aoProcessarQuadro: (info) => this.tratarQuadro(info),
      aoMudarFila: (n) => {
        this.pendentes = n;
      },
      aoCarregarModelo: (b) => {
        this.backend = b;
      },
    });

    this.emAlerta = false;
    await this.orquestrador.iniciar();
  }

  parar(pausando = false): void {
    window.clearTimeout(this.timerRetornoLivre);
    this.emAlerta = false;
    this.orquestrador?.parar(pausando);
  }

  limpar(): void {
    this.parar();
    this.orquestrador = null;
  }
}
