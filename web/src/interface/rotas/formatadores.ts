// Formatação de distância/tempo, na forma escrita (tela) e na forma falada (voz pt-BR).

import type { Passo, Rota } from "./apiRotas";

const virgula = (n: number) => String(n).replace(".", ",");
const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

function quilometros(m: number): number {
  return Math.round(m / 100) / 10;
}

export function distanciaCurta(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${virgula(quilometros(m))} km`;
}

export function distanciaFalada(m: number): string {
  if (m < 1000) return plural(Math.round(m), "metro", "metros");
  const km = quilometros(m);
  return `${virgula(km)} ${km === 1 ? "quilômetro" : "quilômetros"}`;
}

export function duracaoCurta(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export function duracaoFalada(s: number): string {
  const min = Math.round(s / 60);
  if (min < 1) return "menos de 1 minuto";
  if (min < 60) return plural(min, "minuto", "minutos");
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? plural(h, "hora", "horas") : `${plural(h, "hora", "horas")} e ${plural(r, "minuto", "minutos")}`;
}

/** "Vire à esquerda, por 56 metros." (o passo final não tem distância) */
export function textoFaladoDoPasso(p: Passo): string {
  return p.distanciaM > 0 ? `${p.texto}, por ${distanciaFalada(p.distanciaM)}.` : `${p.texto}.`;
}

export function resumoFalado(rota: Rota): string {
  const partes = [
    `Rota calculada: ${distanciaFalada(rota.distanciaM)}, cerca de ${duracaoFalada(rota.duracaoS)}.`,
    `${plural(rota.passos.length, "passo", "passos")}.`,
  ];
  if (rota.obstaculosEvitados > 0) {
    partes.push(`${plural(rota.obstaculosEvitados, "obstáculo evitado", "obstáculos evitados")}.`);
  }
  return partes.join(" ");
}
