// Cenários da câmera auxiliar usados pela interface.
// Hoje alimentam o simulador do pitch; depois o Orquestrador produzirá o mesmo formato (`Cenario`),
// então os componentes não precisam mudar quando a câmera real for ligada.

export type ChaveCenario = "livre" | "placa" | "galho" | "pessoa";

export interface Cenario {
  perigo: boolean;
  icone: string;
  titulo: string;
  descricao: string;
  meta: string;
  fala: string;
  /** Padrão de vibração em ms (vibra, pausa, vibra, ...) */
  vibracao: number[];
}

export const CENARIOS: Record<ChaveCenario, Cenario> = {
  livre: {
    perigo: false,
    icone: "✓",
    titulo: "Caminho Livre",
    descricao: "Nenhum obstáculo aéreo detectado à frente.",
    meta: "Alcance livre: 3 metros",
    fala: "Caminho livre.",
    vibracao: [80],
  },
  placa: {
    perigo: true,
    icone: "!",
    titulo: "Obstáculo Alto!",
    descricao: "Placa suspensa detectada.",
    meta: "Distância: 1,5 metro • Altura da Cabeça",
    fala: "Atenção! Obstáculo alto! Placa suspensa a um metro e meio, na altura da cabeça.",
    vibracao: [300, 100, 300, 100, 400],
  },
  galho: {
    perigo: true,
    icone: "!",
    titulo: "Obstáculo Aéreo!",
    descricao: "Galho de árvore ou marquise baixa.",
    meta: "Distância: 1,2 metro • Altura do Rosto",
    fala: "Cuidado! Galho baixo a um metro e vinte, na altura do rosto.",
    vibracao: [250, 80, 250, 80, 250],
  },
  pessoa: {
    perigo: true,
    icone: "!",
    titulo: "Obstáculo à Frente",
    descricao: "Pessoa parada no trajeto.",
    meta: "Distância: 2 metros • Centro",
    fala: "Atenção: Pessoa parada a dois metros à sua frente.",
    vibracao: [200, 100, 200],
  },
};

/** Botões do simulador (rótulo curto + tecla de atalho no notebook) */
export const SIMULADOR: { chave: ChaveCenario; rotulo: string; tecla: string }[] = [
  { chave: "placa", rotulo: "⚠️ Placa Suspensa (1,5 m)", tecla: "1" },
  { chave: "galho", rotulo: "🌳 Galho / Árvore (1,2 m)", tecla: "2" },
  { chave: "pessoa", rotulo: "🚶 Pessoa Parada (2,0 m)", tecla: "3" },
  { chave: "livre", rotulo: "✅ Caminho Livre", tecla: "4" },
];

/** Dispara sozinho o alerta de placa 3,5 s após iniciar, para o pitch não depender de toques. */
export const DEMO_AUTOMATICA = true;
export const DEMO_AUTOMATICA_MS = 3500;

export const DISTANCIAS_AVISO_M = [1.5, 2, 3] as const;
