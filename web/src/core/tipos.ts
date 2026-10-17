// Tipos do núcleo. Nada aqui depende do navegador: este módulo (e todo
// src/core) pode ser portado para o app nativo sem mudanças.

/** Caixa normalizada (0..1) em relação ao quadro ORIGINAL da câmera. */
export interface Caixa {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Saída do detector após NMS. */
export interface DeteccaoBruta {
  caixa: Caixa;
  classe: number;
  confianca: number;
}

export type Zona = "esquerda" | "centro" | "direita";
export type Proximidade = "perto" | "medio" | "longe";

/** Detecção enriquecida pela heurística de posição e distância. */
export interface DeteccaoAnalisada extends DeteccaoBruta {
  zona: Zona;
  /** A caixa encosta no corredor central de caminhada (com margem). */
  noCorredor: boolean;
  proximidade: Proximidade;
}

/** Um obstáculo acompanhado ao longo dos quadros. */
export interface Rastro {
  id: number;
  classe: number;
  ultima: DeteccaoAnalisada;
  /** Quadros seguidos em que foi visto (tolerando falhas curtas). */
  quadrosVistos: number;
  /** Quadros seguidos sem ser visto. */
  quadrosSemVer: number;
  confirmado: boolean;
  melhorConfianca: number;
  /** Momento (ms) do último alerta emitido para este obstáculo; null = nunca. */
  ultimoAlertaMs: number | null;
  ultimaProximidadeAlertada: Proximidade | null;
  /** Já foi enfileirado para o mapa colaborativo. */
  registrado: boolean;
}

export type Intensidade = "forte" | "fraco";

export interface Alerta {
  rastroId: number;
  classe: number;
  intensidade: Intensidade;
  proximidade: Proximidade;
  zona: Zona;
  noCorredor: boolean;
  mensagem: string;
  /** Padrão para a Vibration API (ms ligado/desligado); null = sem vibração. */
  padraoVibracao: number[] | null;
  prioridade: number;
  /** Deve interromper a fala em andamento. */
  urgente: boolean;
}

/** Registro enviado ao backend (formato do POST /deteccoes). */
export interface RegistroDeteccao {
  id: string;
  classe: string;
  lat: number;
  lng: number;
  precisao_gps: number | null;
  confianca: number;
  timestamp: string;
}

/** Metadados do modelo (labels.json gerado em training/scripts/exportar_onnx.py). */
export interface RotulosModelo {
  modelo: string;
  imgsz: number;
  classes: string[];
  nomes_falados: string[];
}
