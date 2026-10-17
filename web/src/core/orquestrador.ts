// Orquestrador: liga câmera → detector → heurística → rastreio → alerta → registro.
// Depende apenas das "portas" (interfaces), nunca de APIs do navegador.

import type { Config } from "./config";
import { FilaEnvio } from "./filaEnvio";
import { analisar } from "./heuristica";
import { MENSAGENS } from "./mensagens";
import {
  ErroPlataforma,
  type ApiDeteccoes,
  type ArmazenamentoFila,
  type Camera,
  type Detector,
  type GeradorId,
  type Haptico,
  type Localizacao,
  type Relogio,
  type TelaLigada,
  type Voz,
} from "./portas";
import { Priorizador } from "./priorizador";
import { Rastreador } from "./rastreador";
import type { Alerta, DeteccaoAnalisada, DeteccaoBruta, Rastro } from "./tipos";
import { Vigia } from "./vigia";

export type EstadoMonitor = "parado" | "iniciando" | "ativo" | "pausado" | "erro";

export interface Dependencias {
  camera: Camera;
  detector: Detector;
  voz: Voz;
  haptico: Haptico;
  localizacao: Localizacao;
  telaLigada: TelaLigada;
  armazenamento: ArmazenamentoFila;
  api: ApiDeteccoes;
  relogio: Relogio;
  geradorId: GeradorId;
}

/** Informações de cada quadro processado (para o modo debug e o benchmark). */
export interface InfoQuadro {
  deteccoes: DeteccaoAnalisada[];
  ativos: Rastro[];
  alerta: Alerta | null;
  msInferencia: number;
  fps: number;
}

export interface Observadores {
  aoMudarEstado?: (estado: EstadoMonitor, mensagem: string) => void;
  aoProcessarQuadro?: (info: InfoQuadro) => void;
  aoMudarFila?: (pendentes: number) => void;
  aoCarregarModelo?: (backend: string) => void;
}

export class Orquestrador {
  private estado: EstadoMonitor = "parado";
  private geracao = 0; // invalida laços antigos ao parar/reiniciar
  private modeloCarregado = false;
  private cancelarTimers: (() => void)[] = [];
  private fpsMedio = 0;
  private ultimoQuadroMs: number | null = null;
  private classesAlvo: Set<number> | null = null;

  private readonly rastreador: Rastreador;
  private readonly priorizador: Priorizador;
  private readonly vigia: Vigia;
  readonly fila: FilaEnvio;

  constructor(
    private readonly cfg: Config,
    private readonly dep: Dependencias,
    private readonly obs: Observadores = {},
  ) {
    this.rastreador = new Rastreador(cfg.confirmacao);
    this.priorizador = new Priorizador(cfg.alertas, (c) => dep.detector.nomesFalados[c] ?? `obstáculo`);
    this.vigia = new Vigia(cfg.vigia.semQuadroMs);
    this.fila = new FilaEnvio(dep.armazenamento, dep.api, cfg.registro.tamanhoLote, obs.aoMudarFila);
  }

  get estadoAtual(): EstadoMonitor {
    return this.estado;
  }

  private mudarEstado(estado: EstadoMonitor, mensagem: string, falar = true, urgente = false): void {
    this.estado = estado;
    if (falar) this.dep.voz.falar(mensagem, { urgente });
    this.obs.aoMudarEstado?.(estado, mensagem);
  }

  /** Inicia o monitoramento. retomando = volta do segundo plano. */
  async iniciar(retomando = false): Promise<void> {
    if (this.estado === "ativo" || this.estado === "iniciando") return;
    const geracao = ++this.geracao;
    this.mudarEstado("iniciando", retomando ? MENSAGENS.retomado : MENSAGENS.iniciando);

    try {
      if (!this.modeloCarregado) {
        this.obs.aoMudarEstado?.("iniciando", MENSAGENS.carregandoModelo);
        const backend = await this.dep.detector.carregar();
        this.modeloCarregado = true;
        this.classesAlvo = this.calcularClassesAlvo();
        this.obs.aoCarregarModelo?.(backend);
      }
      await this.dep.camera.iniciar();
    } catch (erro) {
      if (geracao !== this.geracao) return;
      this.mudarEstado("erro", this.mensagemDeErro(erro), true, true);
      this.dep.camera.parar();
      return;
    }
    if (geracao !== this.geracao) return; // parado enquanto carregava

    // Localização e tela ligada são "melhor esforço": sem elas, os alertas continuam
    this.dep.localizacao.iniciar().catch((erro) => {
      if (erro instanceof ErroPlataforma && erro.tipo === "permissao_negada") {
        this.dep.voz.falar(MENSAGENS.localizacaoNegada);
      }
    });
    this.dep.telaLigada.ativar().catch(() => undefined);

    this.rastreador.limpar();
    this.priorizador.reiniciar();
    this.vigia.reiniciar(this.dep.relogio.agora());
    this.ultimoQuadroMs = null;
    this.cancelarTimers.push(
      this.dep.relogio.aCada(1000, () => this.verificarVigia()),
      this.dep.relogio.aCada(this.cfg.registro.reenvioMs, () => void this.fila.esvaziar()),
    );
    void this.fila.esvaziar();

    this.mudarEstado("ativo", MENSAGENS.monitorando, !retomando);
    void this.laco(geracao);
  }

  /** Para tudo. pausando = foi para segundo plano (mensagem diferente). */
  parar(pausando = false): void {
    if (this.estado === "parado" || (pausando && this.estado !== "ativo")) return;
    this.geracao++;
    this.cancelarTimers.forEach((c) => c());
    this.cancelarTimers = [];
    this.dep.camera.parar();
    this.dep.localizacao.parar();
    this.dep.telaLigada.liberar().catch(() => undefined);
    this.rastreador.limpar();
    if (pausando) this.mudarEstado("pausado", MENSAGENS.pausadoSegundoPlano);
    else this.mudarEstado("parado", MENSAGENS.parado, true, true);
  }

  private async laco(geracao: number): Promise<void> {
    const intervalo = 1000 / this.cfg.captura.fpsAlvo;
    while (geracao === this.geracao) {
      const inicio = this.dep.relogio.agora();
      try {
        const quadro = await this.dep.camera.capturar();
        if (quadro !== null && geracao === this.geracao) {
          const r = await this.dep.detector.detectar(quadro);
          if (geracao !== this.geracao) break;
          this.processar(r.deteccoes, r.msInferencia, this.dep.relogio.agora());
        }
      } catch (erro) {
        // Falhas isoladas são ignoradas; se persistirem, o vigia avisa o usuário
        console.warn("Falha ao processar quadro:", erro);
      }
      const gasto = this.dep.relogio.agora() - inicio;
      await this.dep.relogio.esperar(Math.max(0, intervalo - gasto));
    }
  }

  /** Processa as detecções de um quadro. Público para testes. */
  processar(brutas: DeteccaoBruta[], msInferencia: number, agoraMs: number): void {
    if (this.ultimoQuadroMs !== null) {
      const fpsInstantaneo = 1000 / Math.max(1, agoraMs - this.ultimoQuadroMs);
      this.fpsMedio = this.fpsMedio === 0 ? fpsInstantaneo : this.fpsMedio * 0.8 + fpsInstantaneo * 0.2;
    }
    this.ultimoQuadroMs = agoraMs;

    if (this.vigia.quadroProcessado(agoraMs) === "voltou") this.dep.voz.falar(MENSAGENS.deteccaoVoltou);

    const alvo = this.classesAlvo;
    const deteccoes = brutas.filter((d) => !alvo || alvo.has(d.classe)).map((d) => analisar(d, this.cfg));
    const { ativos } = this.rastreador.atualizar(deteccoes);

    // Registra ao confirmar; se o GPS ainda não estava pronto, tenta de novo nos próximos quadros
    for (const r of ativos) if (r.confirmado && !r.registrado) void this.registrar(r);

    const alerta = this.priorizador.escolher(ativos, agoraMs);
    if (alerta) {
      if (alerta.padraoVibracao) this.dep.haptico.sinalizar(alerta.padraoVibracao);
      this.dep.voz.falar(alerta.mensagem, { urgente: alerta.urgente });
    }

    this.obs.aoProcessarQuadro?.({ deteccoes, ativos, alerta, msInferencia, fps: this.fpsMedio });
  }

  private verificarVigia(): void {
    if (this.estado !== "ativo") return;
    if (this.vigia.verificar(this.dep.relogio.agora()) === "travou") {
      this.dep.haptico.sinalizar([400, 200, 400]);
      this.dep.voz.falar(MENSAGENS.deteccaoTravada, { urgente: true });
    }
  }

  private async registrar(r: Rastro): Promise<void> {
    if (r.registrado) return;
    const classe = this.dep.detector.classes[r.classe] ?? String(r.classe);
    const permitidas = this.cfg.registro.classes;
    if (permitidas !== "todas" && !permitidas.includes(classe)) return;

    const pos = this.dep.localizacao.ultima();
    const agora = this.dep.relogio.agora();
    if (!pos) return;
    if (pos.precisaoM > this.cfg.registro.precisaoMaxM) return;
    if (agora - pos.timestampMs > this.cfg.registro.idadeMaxPosicaoMs) return;

    r.registrado = true;
    try {
      await this.fila.enfileirar({
        id: this.dep.geradorId.novo(),
        classe,
        lat: pos.lat,
        lng: pos.lng,
        precisao_gps: Math.round(pos.precisaoM * 10) / 10,
        confianca: Math.round(r.melhorConfianca * 1000) / 1000,
        timestamp: this.dep.relogio.agoraIso(),
      });
    } catch (erro) {
      console.warn("Falha ao enfileirar registro:", erro);
    }
  }

  private calcularClassesAlvo(): Set<number> | null {
    const alvo = this.cfg.modelo.classesAlvo;
    if (!alvo) return null;
    const indices = this.dep.detector.classes.flatMap((nome, i) => (alvo.includes(nome) ? [i] : []));
    return new Set(indices);
  }

  private mensagemDeErro(erro: unknown): string {
    if (erro instanceof ErroPlataforma) {
      switch (erro.tipo) {
        case "permissao_negada":
          return MENSAGENS.cameraNegada;
        case "inseguro":
          return MENSAGENS.inseguro;
        case "indisponivel":
        case "nao_suportado":
          return MENSAGENS.cameraIndisponivel;
        case "falha":
          return MENSAGENS.modeloFalhou;
      }
    }
    return MENSAGENS.modeloFalhou;
  }
}
