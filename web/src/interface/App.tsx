import { useState } from "react";
import { BordaAlerta } from "./componentes/BordaAlerta";
import { Cabecalho } from "./componentes/Cabecalho";
import { NavegacaoAbas, type Aba } from "./componentes/NavegacaoAbas";
import { useRota } from "./rotas/useRota";
import { TelaConfig } from "./telas/TelaConfig";
import { TelaInicio } from "./telas/TelaInicio";
import { TelaMonitor } from "./telas/TelaMonitor";
import { TelaRotas } from "./telas/TelaRotas";
import { useSentinela } from "./useSentinela";

export function App() {
  const s = useSentinela();
  const rota = useRota(s.config.voz);
  const [aba, setAba] = useState<Aba>("radar");

  const exibirCameraAoVivo = aba === "radar" && s.tela === "monitor" && s.config.modo === "real";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-2xl md:px-8 md:pt-8">
      {/* Borda de perigo e status global (visível em ambas as abas) */}
      <BordaAlerta ativa={s.emPerigo} />
      <Cabecalho textoStatus={s.textoStatus} perigo={s.emPerigo} />

      {/* Câmera real: quando na tela de monitoramento com IA ativa, exibe preview visual e detecções; caso contrário, mantém montado fora da tela */}
      <div
        className={
          exibirCameraAoVivo
            ? "relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-[#333] bg-black shadow-lg"
            : "camera-oculta"
        }
      >
        <video
          ref={s.videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
        <canvas
          ref={s.canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {exibirCameraAoVivo && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-xs font-bold text-acao backdrop-blur-sm">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-acao" />
            <span>Câmera IA ao vivo</span>
          </div>
        )}
      </div>

      <main className="flex flex-1 flex-col gap-4 pb-2">
        {aba === "rotas" && <TelaRotas controle={rota} />}

        {aba === "radar" && s.tela === "inicio" && (
          <TelaInicio
            modo={s.config.modo}
            onIniciar={s.iniciar}
            onConfig={s.abrirConfig}
            onAlternarModo={s.alternarModo}
          />
        )}

        {aba === "radar" && s.tela === "monitor" && (
          <TelaMonitor
            fase={s.fase}
            modo={s.config.modo}
            mensagemEstado={s.mensagemEstado}
            cenario={s.cenario}
            metricas={s.metricas}
            onRepetir={s.repetirAlerta}
            onPausar={s.pausar}
            onDisparar={s.aplicarCenario}
            onTentarNovamente={s.iniciar}
            onUsarSimulador={s.alternarModo}
          />
        )}

        {aba === "radar" && s.tela === "config" && (
          <TelaConfig
            config={s.config}
            onAlternar={s.alternar}
            onAlternarModo={s.alternarModo}
            onCiclarDistancia={s.ciclarDistancia}
            onSalvar={s.fecharConfig}
          />
        )}
      </main>

      <NavegacaoAbas aba={aba} onMudar={setAba} />
    </div>
  );
}
