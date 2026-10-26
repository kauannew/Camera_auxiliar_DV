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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-2xl md:px-8 md:pt-8">
      {/* Vídeo oculto exigido para a captura de quadros da câmera traseira */}
      <video ref={s.videoRef} playsInline muted aria-hidden="true" className="escondido-visual" />

      {/* Borda de perigo e status global (visível em ambas as abas) */}
      <BordaAlerta ativa={s.emPerigo} />
      <Cabecalho textoStatus={s.textoStatus} perigo={s.emPerigo} />

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
