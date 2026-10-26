// Serviço da API de rotas acessíveis (https://rotas.antonioqueiroz.dev).
// Código puro (sem React/DOM) para ser fácil de testar e de reaproveitar no app nativo.

import type { LineString } from "geojson";

const BASE_PADRAO = "https://rotas.antonioqueiroz.dev";
const TEMPO_LIMITE_MS = 20_000;

export interface Coordenada {
  lat: number;
  lon: number;
}

export interface Passo {
  texto: string;
  /** Extensão do trecho que começa nesta manobra (0 no passo final) */
  distanciaM: number;
}

export interface Rota {
  distanciaM: number;
  duracaoS: number;
  /** Linha da rota em GeoJSON (coordenadas em [lon, lat]) */
  geometria: LineString;
  passos: Passo[];
  /** Quantos obstáculos cadastrados a rota desviou */
  obstaculosEvitados: number;
  motor: string;
}

/** Erro com mensagem já pronta para mostrar (e falar) ao usuário. */
export class ErroRota extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRota";
  }
}

/**
 * Trajeto fixo da demonstração (centro histórico de Salvador, onde a API tem cobertura).
 * Troque por origem = GPS do aparelho e destino = escolhido pelo usuário quando houver busca de endereço.
 */
export const ROTA_DEMO = {
  origem: { lat: -12.9738, lon: -38.5123 } satisfies Coordenada,
  destino: { lat: -12.9713, lon: -38.5083 } satisfies Coordenada,
  nomeOrigem: "Centro Histórico, Salvador",
  nomeDestino: "Rua das Portas do Carmo",
};

export function urlRota(origem: Coordenada, destino: Coordenada, base?: string): string {
  const raiz = base ?? (import.meta.env.VITE_ROTAS_API as string | undefined) ?? BASE_PADRAO;
  return `${raiz}/api/rota?origem=${origem.lat},${origem.lon}&destino=${destino.lat},${destino.lon}`;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const ehNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Valida o JSON da API e o converte para o modelo da interface. Lança ErroRota se algo não bate. */
export function converterResposta(json: unknown): Rota {
  if (!ehObjeto(json)) throw new ErroRota("Resposta inesperada do servidor de rotas.");
  if (typeof json.erro === "string") throw new ErroRota(json.erro);
  if (json.desvioPossivel === false) {
    throw new ErroRota("Não existe rota acessível até este destino.");
  }

  const geo = json.geometria;
  if (!ehObjeto(geo) || geo.type !== "LineString" || !Array.isArray(geo.coordinates) || geo.coordinates.length < 2) {
    throw new ErroRota("A rota recebida não tem um trajeto válido.");
  }
  const coordenadasOk = geo.coordinates.every(
    (c) => Array.isArray(c) && c.length >= 2 && ehNumero(c[0]) && ehNumero(c[1]),
  );
  if (!coordenadasOk) throw new ErroRota("A rota recebida tem coordenadas inválidas.");

  const passos: Passo[] = (Array.isArray(json.instrucoes) ? json.instrucoes : [])
    .filter((i): i is Record<string, unknown> => ehObjeto(i) && typeof i.texto === "string" && i.texto.trim() !== "")
    .map((i) => ({ texto: String(i.texto).trim(), distanciaM: ehNumero(i.distanciaMetros) ? i.distanciaMetros : 0 }));

  return {
    distanciaM: ehNumero(json.distanciaMetros) ? json.distanciaMetros : 0,
    duracaoS: ehNumero(json.duracaoSegundos) ? json.duracaoSegundos : 0,
    geometria: geo as unknown as LineString,
    passos,
    obstaculosEvitados: ehNumero(json.obstaculosEvitados) ? json.obstaculosEvitados : 0,
    motor: typeof json.motor === "string" ? json.motor : "",
  };
}

/** GET /api/rota. Cancelável por `signal`; estoura em 20 s. */
export async function buscarRota(origem: Coordenada, destino: Coordenada, signal?: AbortSignal): Promise<Rota> {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const resposta = await fetch(urlRota(origem, destino), {
    headers: { Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, limite]) : limite,
  });

  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    // corpo vazio ou não-JSON: tratado abaixo
  }

  if (!resposta.ok) {
    const detalhe = ehObjeto(corpo) && typeof corpo.erro === "string" ? ` ${corpo.erro}` : "";
    throw new ErroRota(`O servidor de rotas respondeu com erro ${resposta.status}.${detalhe}`);
  }
  return converterResposta(corpo);
}

/** Texto amigável (e falável) para qualquer falha de `buscarRota`. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ErroRota) return e.message;
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return "O servidor de rotas demorou demais para responder. Tente novamente.";
  }
  if (e instanceof TypeError) {
    return "Sem conexão com o servidor de rotas. Verifique a internet e tente novamente.";
  }
  return "Não foi possível calcular a rota agora. Tente novamente.";
}
