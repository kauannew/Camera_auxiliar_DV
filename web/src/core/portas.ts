// "Portas": interfaces que o núcleo usa para falar com a plataforma.
// O PWA implementa estas interfaces em src/plataforma/web/*. No app nativo,
// basta reimplementá-las (CameraX, Vibrator, TextToSpeech, FusedLocation, Room...).

import type { DeteccaoBruta, RegistroDeteccao } from "./tipos";

/** Erros de plataforma com significado para o usuário (viram mensagens faladas). */
export type TipoErroPlataforma =
  | "permissao_negada"
  | "indisponivel"
  | "inseguro"
  | "nao_suportado"
  | "falha";

export class ErroPlataforma extends Error {
  constructor(
    readonly tipo: TipoErroPlataforma,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroPlataforma";
  }
}

/** Quadro opaco: o núcleo nunca olha dentro (no web é um ImageBitmap). */
export type Quadro = unknown;

export interface Camera {
  iniciar(): Promise<void>;
  /** Captura o quadro atual; null se a câmera ainda não tem imagem. */
  capturar(): Promise<Quadro | null>;
  parar(): void;
}

export interface ResultadoDeteccao {
  deteccoes: DeteccaoBruta[];
  msInferencia: number;
}

export interface Detector {
  /** Carrega o modelo; devolve o nome do backend usado (ex.: "webgpu", "wasm"). */
  carregar(): Promise<string>;
  /** Consome (libera) o quadro. */
  detectar(quadro: Quadro): Promise<ResultadoDeteccao>;
  /** Nome falado (pt-BR) e nome técnico de cada classe, vindos do labels.json. */
  readonly nomesFalados: string[];
  readonly classes: string[];
}

export interface Voz {
  /** urgente = interrompe o que estiver falando. */
  falar(texto: string, opcoes?: { urgente?: boolean }): void;
  calar(): void;
}

export interface Haptico {
  /** Vibra no padrão dado (ou toca bipes equivalentes, se não houver vibração). */
  sinalizar(padrao: number[]): void;
  readonly temVibracao: boolean;
}

export interface Posicao {
  lat: number;
  lng: number;
  precisaoM: number;
  timestampMs: number;
}

export interface Localizacao {
  iniciar(): Promise<void>;
  /** Última posição conhecida (null se ainda não há ou foi negada). */
  ultima(): Posicao | null;
  parar(): void;
}

export interface TelaLigada {
  ativar(): Promise<void>;
  liberar(): Promise<void>;
}

/** Armazenamento persistente da fila de envio (IndexedDB no web). */
export interface ArmazenamentoFila {
  adicionar(registro: RegistroDeteccao): Promise<void>;
  listar(limite: number): Promise<RegistroDeteccao[]>;
  remover(ids: string[]): Promise<void>;
  contar(): Promise<number>;
}

/** ok = aceito; rejeitado = erro do cliente (não adianta reenviar); falha = rede/servidor (reenviar). */
export type ResultadoEnvio = "ok" | "rejeitado" | "falha";

export interface ApiDeteccoes {
  enviar(registros: RegistroDeteccao[]): Promise<ResultadoEnvio>;
}

export interface Relogio {
  agora(): number;
  /** Data/hora atual em ISO 8601 (UTC). */
  agoraIso(): string;
  esperar(ms: number): Promise<void>;
  aCada(ms: number, fn: () => void): () => void;
}

export interface GeradorId {
  novo(): string;
}
