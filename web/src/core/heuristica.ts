// Heurística de posição e distância pela bounding box.
// Funciona porque o celular fica fixo no peito, inclinado para o chão:
// quanto mais baixa a base da caixa no quadro, mais perto o objeto está no chão.
// (Não vale para obstáculos suspensos; ver docs/decisoes.md, D4.)

import type { Config } from "./config";
import type { Caixa, DeteccaoAnalisada, DeteccaoBruta, Proximidade, Zona } from "./tipos";

export function zonaDe(caixa: Caixa, cfg: Config["zonas"]): Zona {
  const cx = (caixa.x1 + caixa.x2) / 2;
  if (cx < cfg.limiteEsquerda) return "esquerda";
  if (cx > cfg.limiteDireita) return "direita";
  return "centro";
}

/** A caixa encosta no corredor de caminhada (largura do corpo + margem)? */
export function tocaCorredor(caixa: Caixa, cfg: Config["zonas"]): boolean {
  const inicio = cfg.corredorInicio - cfg.corredorMargem;
  const fim = cfg.corredorFim + cfg.corredorMargem;
  return caixa.x2 >= inicio && caixa.x1 <= fim;
}

export function proximidadeDe(caixa: Caixa, cfg: Config["distancia"]): Proximidade {
  const baseY = caixa.y2;
  const area = (caixa.x2 - caixa.x1) * (caixa.y2 - caixa.y1);

  let prox: Proximidade = baseY >= cfg.baseYPerto ? "perto" : baseY >= cfg.baseYMedio ? "medio" : "longe";
  // A área reforça: uma caixa enorme está perto mesmo que a base fique cortada no quadro
  if (area >= cfg.areaPerto) prox = "perto";
  else if (area >= cfg.areaMedio && prox === "longe") prox = "medio";
  return prox;
}

export function analisar(det: DeteccaoBruta, cfg: Config): DeteccaoAnalisada {
  return {
    ...det,
    zona: zonaDe(det.caixa, cfg.zonas),
    noCorredor: tocaCorredor(det.caixa, cfg.zonas),
    proximidade: proximidadeDe(det.caixa, cfg.distancia),
  };
}

export const ORDEM_PROXIMIDADE: Record<Proximidade, number> = { longe: 0, medio: 1, perto: 2 };
