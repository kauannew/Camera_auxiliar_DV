// Textos falados em pt-BR: curtos, sempre na mesma ordem (o quê, onde, quão perto),
// para o usuário reconhecer o padrão sem precisar prestar muita atenção.

import type { Proximidade, Zona } from "./tipos";

const PROXIMIDADE_FALADA: Record<Proximidade, string> = {
  perto: "perto",
  medio: "a poucos passos",
  longe: "mais adiante",
};

const LADO_FALADO: Record<Zona, string> = {
  esquerda: "à esquerda",
  centro: "",
  direita: "à direita",
};

/** Primeira letra maiúscula, para a síntese de voz entonar como início de frase. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Ex.: "Buraco à frente, perto, à esquerda" | "Buraco à frente, a poucos passos"
 *      "Buraco ao lado, perto, à direita" (fora do corredor de caminhada)
 */
export function mensagemAlerta(nome: string, noCorredor: boolean, proximidade: Proximidade, zona: Zona): string {
  const partes = [`${capitalizar(nome)} ${noCorredor ? "à frente" : "ao lado"}`, PROXIMIDADE_FALADA[proximidade]];
  if (LADO_FALADO[zona]) partes.push(LADO_FALADO[zona]);
  return partes.join(", ");
}

export const MENSAGENS = {
  iniciando: "Iniciando. Mantenha o celular no peito, com a câmera para a frente.",
  carregandoModelo: "Carregando o detector. Aguarde.",
  monitorando: "Monitoramento ativo. Use sempre a bengala.",
  parado: "Monitoramento parado.",
  pausadoSegundoPlano: "Monitoramento pausado. O aplicativo precisa ficar aberto na tela.",
  retomado: "Monitoramento retomado.",
  deteccaoTravada: "Atenção: a detecção parou. Siga apenas com a bengala.",
  deteccaoVoltou: "Detecção funcionando de novo.",
  cameraNegada:
    "A câmera foi bloqueada. Permita o acesso à câmera nas configurações do navegador e toque em iniciar de novo.",
  cameraIndisponivel: "Não foi possível abrir a câmera. Feche outros aplicativos que usam a câmera e tente de novo.",
  inseguro: "Este endereço não é seguro. Abra o aplicativo por um endereço que comece com https.",
  localizacaoNegada:
    "Localização bloqueada. Os alertas continuam funcionando, mas os obstáculos não serão enviados ao mapa.",
  modeloFalhou: "Não foi possível carregar o detector. Verifique a internet e tente de novo.",
} as const;
