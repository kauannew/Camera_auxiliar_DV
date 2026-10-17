// ============================================================================
//  CONFIGURAÇÃO: todos os limiares ajustáveis durante os testes de rua.
//  Procedimento de calibração: docs/calibracao.md
// ============================================================================
//
// Geometria assumida (celular no PEITO, retrato, câmera traseira):
//   altura da câmera ≈ 1,30 m, inclinada ≈ 30° para baixo, FOV vertical ≈ 65°.
//   Base da caixa (y2, 0 = topo e 1 = rodapé do quadro) → distância aproximada no chão:
//     y2 = 1,00 → ~0,7 m   |  y2 = 0,68 → ~1,5 m   |  y2 = 0,50 → ~2,2 m
//     y2 = 0,42 → ~3,0 m   |  y2 = 0,30 → ~4,2 m
//   Andando a ~1,2 m/s, "perto" (≤ 1,5 m) deixa ~1 s de reação e "médio" (≤ 3 m) ~2,5 s.

import type { Proximidade } from "./tipos";

export interface Config {
  modelo: {
    url: string;
    rotulos: string;
    /** Confiança mínima de uma detecção (antes do NMS). */
    confMin: number;
    /** IoU do NMS. */
    iouNms: number;
    /** Nomes das classes que geram alerta; null = todas as classes do modelo. */
    classesAlvo: string[] | null;
  };
  captura: {
    /** Teto de quadros por segundo enviados à inferência (o navegador é lento). */
    fpsAlvo: number;
  };
  zonas: {
    /** Fronteiras das zonas pela posição do CENTRO da caixa. */
    limiteEsquerda: number;
    limiteDireita: number;
    /** Corredor central de caminhada (largura do corpo + folga). */
    corredorInicio: number;
    corredorFim: number;
    /** Folga extra em cada lado do corredor. */
    corredorMargem: number;
  };
  distancia: {
    /** y2 (base da caixa) a partir do qual o obstáculo é "perto". */
    baseYPerto: number;
    /** y2 a partir do qual é "médio" (abaixo disso, "longe"). */
    baseYMedio: number;
    /** Área relativa (w·h) que, sozinha, já indica "perto". */
    areaPerto: number;
    /** Área relativa que promove "longe" para "médio". */
    areaMedio: number;
  };
  confirmacao: {
    /** Quadros seguidos para confirmar um obstáculo (≈ 0,75 s a 4 FPS). */
    quadros: number;
    /** Quando está perto, confirma mais rápido. */
    quadrosPerto: number;
    /** Falhas seguidas toleradas sem zerar a contagem (o detector "pisca"). */
    toleranciaFalhas: number;
    /** Quadros sem ver até esquecer o obstáculo. */
    quadrosParaEsquecer: number;
    /** IoU mínima para considerar a mesma caixa entre quadros. */
    iouAssociacao: number;
    /** Ou distância máxima entre centros (normalizada), útil ao caminhar rápido. */
    distCentroAssociacao: number;
  };
  alertas: {
    /** Tempo mínimo entre dois alertas do MESMO obstáculo. */
    cooldownObstaculoMs: number;
    /** Tempo mínimo entre duas falas quaisquer (evita metralhar o usuário). */
    intervaloEntreFalasMs: number;
    /** Realerta antes do cooldown se o obstáculo ficou mais perto. */
    realertarAoAproximar: boolean;
    /** Obstáculo fora do corredor e perto gera aviso falado fraco (sem vibrar). */
    avisarLateralPerto: boolean;
    /** Obstáculo no corredor mas longe gera aviso? (padrão: não, só ruído) */
    avisarLonge: boolean;
    /** Padrões de vibração: quanto mais perto, mais rápido. */
    vibracao: Record<Proximidade, number[]>;
  };
  registro: {
    /** Classes enviadas ao mapa colaborativo; "todas" só para testes. */
    classes: string[] | "todas";
    /** Descarta posição GPS pior que isto (metros). */
    precisaoMaxM: number;
    /** Descarta posição GPS mais velha que isto. */
    idadeMaxPosicaoMs: number;
    /** Intervalo de reenvio da fila offline. */
    reenvioMs: number;
    /** Máximo de registros por POST. */
    tamanhoLote: number;
  };
  vigia: {
    /** Sem quadro processado por este tempo → avisa que a detecção parou. */
    semQuadroMs: number;
  };
}

export const CONFIG_PADRAO: Config = {
  modelo: {
    // Troque por /modelos/buraco.onnx quando o modelo treinado estiver pronto
    url: "/modelos/provisorio_coco.onnx",
    rotulos: "/modelos/provisorio_coco.labels.json",
    confMin: 0.4,
    iouNms: 0.45,
    classesAlvo: null,
  },
  captura: {
    fpsAlvo: 4,
  },
  zonas: {
    limiteEsquerda: 0.36,
    limiteDireita: 0.64,
    corredorInicio: 0.3,
    corredorFim: 0.7,
    corredorMargem: 0.05,
  },
  distancia: {
    baseYPerto: 0.68,
    baseYMedio: 0.42,
    areaPerto: 0.1,
    areaMedio: 0.035,
  },
  confirmacao: {
    quadros: 3,
    quadrosPerto: 2,
    toleranciaFalhas: 1,
    quadrosParaEsquecer: 4,
    iouAssociacao: 0.2,
    distCentroAssociacao: 0.15,
  },
  alertas: {
    cooldownObstaculoMs: 8000,
    intervaloEntreFalasMs: 2500,
    realertarAoAproximar: true,
    avisarLateralPerto: true,
    avisarLonge: false,
    vibracao: {
      perto: [80, 40, 80, 40, 80, 40, 80],
      medio: [150, 120, 150],
      longe: [250],
    },
  },
  registro: {
    classes: ["buraco", "obstaculo_suspenso"],
    precisaoMaxM: 30,
    idadeMaxPosicaoMs: 15000,
    reenvioMs: 30000,
    tamanhoLote: 50,
  },
  vigia: {
    semQuadroMs: 3000,
  },
};

type Parcial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : Parcial<T[K]>) : T[K] };

/** Mescla ajustes parciais (ex.: vindos da URL no modo debug) sobre o padrão. */
export function mesclarConfig(base: Config, ajustes: Parcial<Config>): Config {
  // cópia via JSON (e não structuredClone) para rodar também em runtimes nativos
  const resultado = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>>;
  for (const [secao, valores] of Object.entries(ajustes)) {
    if (valores && typeof valores === "object") {
      resultado[secao] = { ...resultado[secao], ...(valores as Record<string, unknown>) };
    }
  }
  return resultado as unknown as Config;
}
