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
 * Trajeto fixo da demonstração padrão (centro histórico de Salvador, onde a API tem cobertura com desvio ativo).
 */
export const ROTA_DEMO = {
  origem: { lat: -12.9738, lon: -38.5123 } satisfies Coordenada,
  destino: { lat: -12.9713, lon: -38.5083 } satisfies Coordenada,
  nomeOrigem: "Pelourinho, Salvador (BA)",
  nomeDestino: "Rua das Portas do Carmo",
};

export interface DefinicaoTrajeto {
  id: string;
  estado: string;
  nomeEstado: string;
  nomeCidade: string;
  titulo: string;
  origem: Coordenada;
  destino: Coordenada;
  nomeOrigem: string;
  nomeDestino: string;
  descricaoDestaque?: string;
}

export const ESTADOS_DISPONIVEIS = [
  { id: "BA", nome: "Bahia (BA) · Salvador" },
  { id: "PE", nome: "Pernambuco (PE) · Recife" },
  { id: "CE", nome: "Ceará (CE) · Fortaleza" },
  { id: "SP", nome: "São Paulo (SP) · Capital" },
  { id: "RJ", nome: "Rio de Janeiro (RJ) · Copacabana" },
  { id: "MG", nome: "Minas Gerais (MG) · Belo Horizonte" },
  { id: "DF", nome: "Distrito Federal (DF) · Brasília" },
  { id: "PR", nome: "Paraná (PR) · Curitiba" },
  { id: "AM", nome: "Amazonas (AM) · Manaus" },
] as const;

export const TRAJETOS_PREDEFINIDOS: DefinicaoTrajeto[] = [
  {
    id: "salvador-pelourinho",
    estado: "BA",
    nomeEstado: "Bahia (BA)",
    nomeCidade: "Salvador",
    titulo: "Pelourinho → Portas do Carmo (Desvio de Buracos)",
    origem: { lat: -12.9738, lon: -38.5123 },
    destino: { lat: -12.9713, lon: -38.5083 },
    nomeOrigem: "Pelourinho, Salvador (BA)",
    nomeDestino: "Rua das Portas do Carmo",
    descricaoDestaque: "Desvio de obstáculo ativo",
  },
  {
    id: "recife-marco-zero",
    estado: "PE",
    nomeEstado: "Pernambuco (PE)",
    nomeCidade: "Recife",
    titulo: "Boa Vista → Marco Zero (Recife Antigo)",
    origem: { lat: -8.0601, lon: -34.8883 },
    destino: { lat: -8.0631, lon: -34.8711 },
    nomeOrigem: "Av. Conde da Boa Vista, Recife (PE)",
    nomeDestino: "Marco Zero (Recife Antigo)",
  },
  {
    id: "ce-beira-mar",
    estado: "CE",
    nomeEstado: "Ceará (CE)",
    nomeCidade: "Fortaleza",
    titulo: "Av. Beira Mar → Feirinha de Artesanato",
    origem: { lat: -3.7258, lon: -38.5023 },
    destino: { lat: -3.7245, lon: -38.4985 },
    nomeOrigem: "Av. Beira Mar, Fortaleza (CE)",
    nomeDestino: "Feirinha da Beira Mar",
  },
  {
    id: "sp-paulista",
    estado: "SP",
    nomeEstado: "São Paulo (SP)",
    nomeCidade: "São Paulo",
    titulo: "Av. Paulista → MASP",
    origem: { lat: -23.5615, lon: -46.6559 },
    destino: { lat: -23.563, lon: -46.654 },
    nomeOrigem: "Av. Paulista, São Paulo (SP)",
    nomeDestino: "MASP / Praça Lunardelli",
  },
  {
    id: "rj-copacabana",
    estado: "RJ",
    nomeEstado: "Rio de Janeiro (RJ)",
    nomeCidade: "Rio de Janeiro",
    titulo: "Copacabana Posto 4 → Posto 5",
    origem: { lat: -22.9731, lon: -43.1873 },
    destino: { lat: -22.9774, lon: -43.1904 },
    nomeOrigem: "Posto 4, Copacabana, Rio de Janeiro (RJ)",
    nomeDestino: "Posto 5, Copacabana",
  },
  {
    id: "mg-liberdade",
    estado: "MG",
    nomeEstado: "Minas Gerais (MG)",
    nomeCidade: "Belo Horizonte",
    titulo: "Praça da Liberdade → Circuito Cultural",
    origem: { lat: -19.932, lon: -43.938 },
    destino: { lat: -19.9332, lon: -43.9372 },
    nomeOrigem: "Praça da Liberdade, Belo Horizonte (MG)",
    nomeDestino: "Circuito Cultural / Palácio",
  },
  {
    id: "df-esplanada",
    estado: "DF",
    nomeEstado: "Distrito Federal (DF)",
    nomeCidade: "Brasília",
    titulo: "Esplanada dos Ministérios → Catedral",
    origem: { lat: -15.7975, lon: -47.8762 },
    destino: { lat: -15.7983, lon: -47.8755 },
    nomeOrigem: "Esplanada dos Ministérios, Brasília (DF)",
    nomeDestino: "Catedral Metropolitana de Brasília",
  },
  {
    id: "pr-curitiba",
    estado: "PR",
    nomeEstado: "Paraná (PR)",
    nomeCidade: "Curitiba",
    titulo: "Rua XV de Novembro → Praça Osório",
    origem: { lat: -25.4297, lon: -49.2719 },
    destino: { lat: -25.4326, lon: -49.2762 },
    nomeOrigem: "Calçadão das Flores, Curitiba (PR)",
    nomeDestino: "Praça Osório",
  },
  {
    id: "am-manaus",
    estado: "AM",
    nomeEstado: "Amazonas (AM)",
    nomeCidade: "Manaus",
    titulo: "Praça da Matriz → Teatro Amazonas",
    origem: { lat: -3.136, lon: -60.0237 },
    destino: { lat: -3.1303, lon: -60.0232 },
    nomeOrigem: "Praça da Matriz, Manaus (AM)",
    nomeDestino: "Teatro Amazonas (Centro Histórico)",
  },
];

/** Obtém a localização GPS real do aparelho. */
export async function obterGpsAtual(): Promise<Coordenada> {
  if (!("geolocation" in navigator)) {
    throw new ErroRota("Seu dispositivo ou navegador não possui suporte a GPS.");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new ErroRota("Permissão de GPS negada. Ative a localização no navegador para traçar a rota."));
        } else if (err.code === err.TIMEOUT) {
          reject(new ErroRota("Tempo esgotado ao buscar GPS. Verifique se o sinal de localização está disponível."));
        } else {
          reject(new ErroRota("Não foi possível obter a sua localização atual."));
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  });
}

/** Calcula um destino de pedestre a ~400 metros da localização atual. */
export function gerarDestinoProximo(origem: Coordenada, distanciaMetros = 400): Coordenada {
  const deslocamentoLat = (distanciaMetros * 0.707) / 111139;
  const radLat = (origem.lat * Math.PI) / 180;
  const deslocamentoLon = (distanciaMetros * 0.707) / (111139 * Math.cos(radLat));
  return {
    lat: Number((origem.lat + deslocamentoLat).toFixed(6)),
    lon: Number((origem.lon + deslocamentoLon).toFixed(6)),
  };
}

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
