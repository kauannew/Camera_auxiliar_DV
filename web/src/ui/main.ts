// Ponto de entrada da interface: monta os adaptadores web e liga ao orquestrador.
//
// Parâmetros de URL úteis nos testes:
//   ?debug=1            abre direto no modo calibração
//   ?bench              página de medição de desempenho (&imagem=/x.jpg usa uma imagem fixa)
//   ?backend=wasm       força o backend (wasm | webgpu)
//   ?modelo=buraco      usa /modelos/buraco.onnx + buraco.labels.json
//   ?registrarTodas=1   envia ao mapa qualquer classe (para testar com o modelo provisório)
//   ?fps=5              muda o teto de quadros por segundo

import "./estilo.css";
import { CONFIG_PADRAO, mesclarConfig, type Config } from "../core/config";
import { Orquestrador, type EstadoMonitor, type InfoQuadro } from "../core/orquestrador";
import { CameraWeb } from "../plataforma/web/cameraWeb";
import { DetectorWorker } from "../plataforma/web/detectorWorker";
import {
  ApiHttp,
  ArmazenamentoIndexedDB,
  LocalizacaoWeb,
  TelaLigadaWeb,
  geradorIdWeb,
  relogioWeb,
} from "../plataforma/web/diversosWeb";
import { HapticoWeb } from "../plataforma/web/hapticoWeb";
import { VozWeb } from "../plataforma/web/vozWeb";
import { rodarBench } from "./bench";
import { SobreposicaoDebug } from "./debug";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ configuração

const params = new URLSearchParams(location.search);
const forcarBackend = (["wasm", "webgpu"] as const).find((b) => b === params.get("backend"));

function montarConfig(): Config {
  const modelo = params.get("modelo");
  return mesclarConfig(CONFIG_PADRAO, {
    ...(modelo ? { modelo: { url: `/modelos/${modelo}.onnx`, rotulos: `/modelos/${modelo}.labels.json` } } : {}),
    ...(params.get("registrarTodas") ? { registro: { classes: "todas" as const } } : {}),
    ...(params.get("fps") ? { captura: { fpsAlvo: Number(params.get("fps")) } } : {}),
  });
}
const cfg = montarConfig();

// ------------------------------------------------------------------ elementos

const video = $<HTMLVideoElement>("video");
const status = $<HTMLParagraphElement>("status");
const botao = $<HTMLButtonElement>("botao-principal");
const botaoDebug = $<HTMLButtonElement>("botao-debug");
const painelDebug = $<HTMLElement>("painel-debug");
const metricas = $<HTMLDListElement>("metricas");

// ------------------------------------------------------------------ modo benchmark

if (params.has("bench")) {
  $<HTMLElement>("painel-bench").hidden = false;
  botao.hidden = true;
  painelDebug.classList.remove("escondido-visual");
  status.textContent = "Modo de medição.";
  $<HTMLButtonElement>("botao-bench").addEventListener("click", async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement;
    b.disabled = true;
    try {
      await rodarBench(cfg, video, $<HTMLElement>("saida-bench"), forcarBackend, 50, params.get("imagem"));
    } catch (erro) {
      $<HTMLElement>("saida-bench").textContent += `\nErro: ${erro}`;
    } finally {
      b.disabled = false;
    }
  });
} else {
  iniciarApp();
}

// ------------------------------------------------------------------ app principal

function iniciarApp(): void {
  const voz = new VozWeb();
  const haptico = new HapticoWeb();
  const detector = new DetectorWorker(cfg.modelo, forcarBackend);
  const localizacao = new LocalizacaoWeb();
  const estadoDebug = { backend: "—", pendentes: 0, ultimoAlerta: "—" };
  let debugAtivo = params.get("debug") === "1";

  const sobreposicao = new SobreposicaoDebug($("sobreposicao"), video, cfg, () => detector.nomesFalados);

  const orq = new Orquestrador(
    cfg,
    {
      camera: new CameraWeb(video),
      detector,
      voz,
      haptico,
      localizacao,
      telaLigada: new TelaLigadaWeb(),
      armazenamento: new ArmazenamentoIndexedDB(),
      api: new ApiHttp(),
      relogio: relogioWeb,
      geradorId: geradorIdWeb,
    },
    {
      aoMudarEstado: atualizarEstado,
      aoProcessarQuadro: (info) => {
        if (info.alerta) estadoDebug.ultimoAlerta = info.alerta.mensagem;
        if (debugAtivo) {
          sobreposicao.desenhar(info);
          atualizarMetricas(info);
        }
      },
      aoMudarFila: (n) => (estadoDebug.pendentes = n),
      aoCarregarModelo: (b) => (estadoDebug.backend = b),
    },
  );

  function atualizarEstado(estado: EstadoMonitor, mensagem: string): void {
    status.textContent = mensagem;
    const ativo = estado === "ativo" || estado === "iniciando";
    botao.setAttribute("aria-pressed", String(ativo));
    botao.textContent = ativo ? "Parar monitoramento" : "Iniciar monitoramento";
  }

  function atualizarMetricas(info: InfoQuadro): void {
    const pos = localizacao.ultima();
    const linhas: [string, string][] = [
      ["Backend", estadoDebug.backend],
      ["FPS", info.fps.toFixed(1)],
      ["Inferência", `${info.msInferencia.toFixed(0)} ms`],
      ["Detecções", String(info.deteccoes.length)],
      ["Confirmados", String(info.ativos.filter((r) => r.confirmado).length)],
      ["Último alerta", estadoDebug.ultimoAlerta],
      ["GPS", pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${pos.precisaoM.toFixed(0)} m)` : "sem posição"],
      ["Fila p/ mapa", String(estadoDebug.pendentes)],
      ["Vibração", haptico.temVibracao ? "sim" : "não (bipes)"],
    ];
    metricas.replaceChildren(
      ...linhas.flatMap(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        return [dt, dd];
      }),
    );
  }

  function aplicarDebug(): void {
    botaoDebug.setAttribute("aria-pressed", String(debugAtivo));
    painelDebug.classList.toggle("escondido-visual", !debugAtivo);
    if (!debugAtivo) sobreposicao.limpar();
  }
  aplicarDebug();

  botao.addEventListener("click", () => {
    // Gesto do usuário: destrava voz (iOS) e áudio dos bipes
    voz.destravar();
    haptico.destravar();
    if (orq.estadoAtual === "ativo" || orq.estadoAtual === "iniciando") orq.parar();
    else void orq.iniciar();
  });

  botaoDebug.addEventListener("click", () => {
    debugAtivo = !debugAtivo;
    aplicarDebug();
  });

  // Sem segundo plano no navegador: pausa ao esconder a aba e retoma ao voltar
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") orq.parar(true);
    else if (orq.estadoAtual === "pausado") void orq.iniciar(true);
  });

  // Rede voltou → tenta esvaziar a fila de envios na hora
  window.addEventListener("online", () => void orq.fila.esvaziar());

  if (!window.isSecureContext) {
    status.textContent = "Atenção: abra por um endereço https. Sem isso, câmera e GPS não funcionam.";
  }
}

// ------------------------------------------------------------------ PWA

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker não registrado:", e));
  });
}
