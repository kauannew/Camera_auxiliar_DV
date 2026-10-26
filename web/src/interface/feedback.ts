// Feedback multissensorial da interface: voz (Web Speech), bipes (Web Audio) e vibração.
// Sem arquivos de áudio externos.

let contextoAudio: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    contextoAudio ??= new Ctor();
    if (contextoAudio.state === "suspended") void contextoAudio.resume();
    return contextoAudio;
  } catch {
    return null;
  }
}

/** Bipe agudo e áspero (perigo, 880 Hz) ou suave (confirmação, 440 Hz). */
export function tocarBipe(perigo: boolean): void {
  const ctx = obterContexto();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.connect(ganho);
  ganho.connect(ctx.destination);
  const duracao = perigo ? 0.18 : 0.12;
  osc.type = perigo ? "sawtooth" : "sine";
  osc.frequency.setValueAtTime(perigo ? 880 : 440, ctx.currentTime);
  ganho.gain.setValueAtTime(perigo ? 0.25 : 0.15, ctx.currentTime);
  osc.start();
  osc.stop(ctx.currentTime + duracao);
}

// Leitura em sequência (trajeto passo a passo). Só existe uma por vez; qualquer outra fala a interrompe,
// então um alerta de obstáculo do radar sempre passa na frente das instruções da rota.
let sequenciaAtual: { id: number; aoTerminar: () => void } | null = null;
let contadorSequencia = 0;
// O Chrome pode coletar utterances sem referência antes dos eventos onstart/onend: mantemos as da fila
let falasRetidas: SpeechSynthesisUtterance[] = [];

function encerrarSequencia(): void {
  const s = sequenciaAtual;
  sequenciaAtual = null;
  s?.aoTerminar();
}

function criarFala(texto: string): SpeechSynthesisUtterance {
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 1.15; // ritmo ágil, padrão entre usuários de leitor de tela
  return fala;
}

/** Fala em pt-BR, interrompendo a fala anterior (e qualquer leitura em sequência). */
export function falar(texto: string): void {
  if (!texto || !("speechSynthesis" in window)) return;
  encerrarSequencia();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(criarFala(texto));
}

/** Interrompe qualquer fala em andamento. */
export function pararFala(): void {
  if (!("speechSynthesis" in window)) return;
  encerrarSequencia();
  window.speechSynthesis.cancel();
}

interface OpcoesSequencia {
  /** Chamado quando o item `i` (índice em `textos`) começa a ser falado */
  aoIniciarItem: (i: number) => void;
  /** Chamado ao terminar, ou quando outra fala/`pararFala` interrompe a sequência */
  aoTerminar: () => void;
  /** Índice do primeiro item a falar */
  inicio?: number;
}

/** Fala `textos` um após o outro. Devolve false se o navegador não tem síntese de voz. */
export function falarSequencia(textos: string[], { aoIniciarItem, aoTerminar, inicio = 0 }: OpcoesSequencia): boolean {
  if (!("speechSynthesis" in window) || inicio >= textos.length) return false;
  encerrarSequencia();
  window.speechSynthesis.cancel();

  const id = ++contadorSequencia;
  sequenciaAtual = { id, aoTerminar };
  const ultimo = textos.length - 1;
  falasRetidas = [];

  for (let i = inicio; i <= ultimo; i++) {
    const fala = criarFala(textos[i]);
    falasRetidas.push(fala);
    fala.onstart = () => {
      if (sequenciaAtual?.id === id) aoIniciarItem(i);
    };
    if (i === ultimo) {
      fala.onend = () => {
        if (sequenciaAtual?.id !== id) return;
        sequenciaAtual = null;
        aoTerminar();
      };
    }
    fala.onerror = () => {
      // Interrupção por outra fala já limpou `sequenciaAtual` (id diferente): nada a fazer
      if (sequenciaAtual?.id !== id) return;
      sequenciaAtual = null;
      window.speechSynthesis.cancel();
      aoTerminar();
    };
    window.speechSynthesis.speak(fala);
  }
  return true;
}

export function vibrar(padrao: number | number[]): void {
  if ("vibrate" in navigator) navigator.vibrate(padrao);
}
