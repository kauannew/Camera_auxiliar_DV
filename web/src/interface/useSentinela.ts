import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EstadoMonitor } from "../core/orquestrador";
import { PonteOrquestrador, type MetricasQuadro } from "./camera/ponteOrquestrador";
import {
  CENARIOS,
  DEMO_AUTOMATICA,
  DEMO_AUTOMATICA_MS,
  DISTANCIAS_AVISO_M,
  SIMULADOR,
  type Cenario,
  type ChaveCenario,
} from "./cenarios";
import { falar, tocarBipe, vibrar } from "./feedback";

export type Tela = "inicio" | "monitor" | "config";
/** pronto = em espera · iniciando = carregando IA / abrindo câmera · ativo = monitorando · pausado = pausado · erro = falha na câmera/permissão */
export type Fase = "pronto" | "iniciando" | "ativo" | "pausado" | "erro";
export type ModoDetector = "real" | "simulado";

export interface Configuracoes {
  voz: boolean;
  bipes: boolean;
  vibracao: boolean;
  distanciaAvisoM: number;
  modo: ModoDetector;
}

const CONFIG_INICIAL: Configuracoes = {
  voz: true,
  bipes: true,
  vibracao: true,
  distanciaAvisoM: 1.5,
  modo: "simulado",
};

/**
 * Estado e ações da interface do Sentinela Visual.
 * Suporta o modo Câmera Real (Orquestrador + YOLO + Web Worker) e o modo Simulador (para o Pitch).
 */
export function useSentinela() {
  const [tela, setTela] = useState<Tela>("inicio");
  const [fase, setFase] = useState<Fase>("pronto");
  const [cenario, setCenario] = useState<Cenario>(CENARIOS.livre);
  const [config, setConfig] = useState<Configuracoes>(CONFIG_INICIAL);
  const [mensagemEstado, setMensagemEstado] = useState<string>("Sistema pronto para iniciar.");
  const [metricas, setMetricas] = useState<MetricasQuadro | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const configRef = useRef(config);
  const faseRef = useRef<Fase>("pronto");
  const ultimaFalaRef = useRef("Sistema pronto para iniciar.");
  const timerDemoRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Aplica cenário simulado (ou acionado manualmente nos atalhos do teclado / simulador do pitch)
  const aplicarCenario = useCallback((chave: ChaveCenario, falaOverride?: string) => {
    const cen = CENARIOS[chave];
    const cfg = configRef.current;
    const fala = falaOverride ?? cen.fala;
    setCenario(cen);
    ultimaFalaRef.current = fala;
    if (cfg.bipes) tocarBipe(cen.perigo);
    if (cfg.vibracao) vibrar(cen.vibracao);
    if (cfg.voz) falar(fala);
  }, []);

  // Criação da ponte estável com o Orquestrador da Câmera
  const ponteRef = useRef<PonteOrquestrador | null>(null);
  if (!ponteRef.current) {
    ponteRef.current = new PonteOrquestrador(
      () => configRef.current,
      {
        aoMudarEstado: (estado: EstadoMonitor, msg: string) => {
          const proximaFase: Fase = estado === "parado" ? "pronto" : estado;
          setFase(proximaFase);
          faseRef.current = proximaFase;
          setMensagemEstado(msg);
          ultimaFalaRef.current = msg;
        },
        aoDetectarAlerta: (cenReal: Cenario) => {
          setCenario(cenReal);
          ultimaFalaRef.current = cenReal.fala;
        },
        aoCaminhoLivre: () => {
          const cenLivre = CENARIOS.livre;
          setCenario(cenLivre);
          ultimaFalaRef.current = cenLivre.fala;
        },
        aoAtualizarMetricas: (novasMetricas) => {
          setMetricas(novasMetricas);
        },
      },
    );
  }

  // Vincula o elemento de vídeo à ponte
  useEffect(() => {
    ponteRef.current?.conectarVideo(videoRef.current);
  }, []);

  // Iniciar Monitoramento
  const iniciar = useCallback(async () => {
    window.clearTimeout(timerDemoRef.current);
    const cfg = configRef.current;

    if (cfg.modo === "real") {
      setFase("iniciando");
      faseRef.current = "iniciando";
      setTela("monitor");
      setCenario(CENARIOS.livre);
      try {
        await ponteRef.current?.iniciar();
      } catch (e) {
        console.error("Falha ao iniciar motor de câmera:", e);
      }
    } else {
      // Modo simulador (pitch)
      faseRef.current = "ativo";
      setFase("ativo");
      setTela("monitor");
      aplicarCenario("livre", "Monitoramento iniciado. Caminho livre.");

      if (DEMO_AUTOMATICA) {
        timerDemoRef.current = window.setTimeout(() => {
          if (faseRef.current === "ativo") aplicarCenario("placa");
        }, DEMO_AUTOMATICA_MS);
      }
    }
  }, [aplicarCenario]);

  // Pausar Monitoramento
  const pausar = useCallback(() => {
    window.clearTimeout(timerDemoRef.current);
    const cfg = configRef.current;

    if (cfg.modo === "real") {
      ponteRef.current?.parar();
    }

    faseRef.current = "pausado";
    setFase("pausado");
    setCenario(CENARIOS.livre);
    setTela("inicio");

    if (cfg.vibracao) vibrar(150);
    ultimaFalaRef.current = "Monitoramento pausado.";
    if (cfg.voz) falar("Monitoramento pausado.");
  }, []);

  const repetirAlerta = useCallback(() => {
    const cfg = configRef.current;
    if (cfg.bipes) tocarBipe(false);
    if (cfg.voz) falar(ultimaFalaRef.current);
  }, []);

  const abrirConfig = useCallback(() => {
    setTela("config");
    if (configRef.current.voz) falar("Configurações de áudio e vibração.");
  }, []);

  const fecharConfig = useCallback(() => {
    setTela("inicio");
    if (configRef.current.voz) falar("Configurações salvas. Tela inicial.");
  }, []);

  const alternar = useCallback((campo: "voz" | "bipes" | "vibracao") => {
    const proximo = { ...configRef.current, [campo]: !configRef.current[campo] };
    configRef.current = proximo;
    setConfig(proximo);

    const ligado = proximo[campo];
    const mensagens = {
      voz: ligado ? "Voz do aplicativo ativada" : "Voz do aplicativo desativada",
      bipes: ligado ? "Bipes sonoros ativados" : "Bipes sonoros desativados",
      vibracao: ligado ? "Vibração ativada" : "Vibração desativada",
    } as const;

    if (campo === "bipes" && ligado) tocarBipe(false);
    if (campo === "vibracao" && ligado) vibrar(100);
    if (proximo.voz) falar(mensagens[campo]);
    else if (campo === "voz" && proximo.bipes) tocarBipe(false);
  }, []);

  const alternarModo = useCallback(() => {
    const novoModo: ModoDetector = configRef.current.modo === "real" ? "simulado" : "real";
    if (faseRef.current === "ativo" || faseRef.current === "iniciando") {
      ponteRef.current?.parar();
      window.clearTimeout(timerDemoRef.current);
      setFase("pronto");
      faseRef.current = "pronto";
    }

    const proximo = { ...configRef.current, modo: novoModo };
    configRef.current = proximo;
    setConfig(proximo);

    const msg = novoModo === "real" ? "Modo câmera real com inteligência artificial ativado" : "Modo simulador de apresentação ativado";
    if (proximo.voz) falar(msg);
  }, []);

  const ciclarDistancia = useCallback(() => {
    const atual = configRef.current.distanciaAvisoM;
    const i = DISTANCIAS_AVISO_M.findIndex((d) => d === atual);
    const proxima = DISTANCIAS_AVISO_M[(i + 1) % DISTANCIAS_AVISO_M.length];
    const proximo = { ...configRef.current, distanciaAvisoM: proxima };
    configRef.current = proximo;
    setConfig(proximo);
    if (proximo.voz) falar(`Distância de aviso: ${formatarDistancia(proxima, true)}`);
  }, []);

  // Atalhos 1–4 para apresentação pelo teclado do notebook (disponíveis nos dois modos para segurança do pitch)
  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => {
      if (faseRef.current !== "ativo" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const item = SIMULADOR.find((s) => s.tecla === ev.key);
      if (item) aplicarCenario(item.chave);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aplicarCenario]);

  // Segundo plano no celular: pausa quando o app perde o foco e retoma quando volta
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") {
        if (faseRef.current === "ativo" && configRef.current.modo === "real") {
          ponteRef.current?.parar(true);
        }
      } else if (faseRef.current === "pausado" && configRef.current.modo === "real") {
        void ponteRef.current?.iniciar();
      }
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(timerDemoRef.current);
    ponteRef.current?.limpar();
  }, []);

  const emPerigo = fase === "ativo" && cenario.perigo;

  const textoStatus = useMemo(() => {
    if (fase === "erro") return "FALHA NA CÂMERA";
    if (fase === "iniciando") return "Iniciando Câmera e IA...";
    if (emPerigo) return "ALERTA DE PROXIMIDADE!";
    if (fase === "ativo") {
      return config.modo === "real" ? "Câmera Ativa • IA Conectada" : "Radar Ativo: Lendo Ambiente (Simulado)";
    }
    if (fase === "pausado") return "Câmera Auxiliar: Em Espera";
    return config.modo === "real" ? "Câmera Auxiliar: Pronta (Modo IA)" : "Câmera Auxiliar: Conectada (Simulador)";
  }, [fase, emPerigo, config.modo]);

  return {
    tela,
    fase,
    config,
    cenario,
    emPerigo,
    textoStatus,
    mensagemEstado,
    metricas,
    videoRef,
    iniciar,
    pausar,
    repetirAlerta,
    abrirConfig,
    fecharConfig,
    alternar,
    alternarModo,
    ciclarDistancia,
    aplicarCenario,
  };
}

export function formatarDistancia(metros: number, extenso = false): string {
  const n = String(metros).replace(".", ",");
  if (!extenso) return `${n} m`;
  return `${n} ${metros === 1 ? "metro" : "metros"}`;
}
