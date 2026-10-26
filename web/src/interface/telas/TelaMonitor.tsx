import { BarraSimulador } from "../componentes/BarraSimulador";
import { Botao } from "../componentes/Botao";
import { CartaoRadar } from "../componentes/CartaoRadar";
import type { MetricasQuadro } from "../camera/ponteOrquestrador";
import type { Cenario, ChaveCenario } from "../cenarios";
import type { Fase, ModoDetector } from "../useSentinela";
import { useFocoNoTitulo } from "../useFocoNoTitulo";

interface Props {
  fase: Fase;
  modo: ModoDetector;
  mensagemEstado: string;
  cenario: Cenario;
  metricas: MetricasQuadro | null;
  onRepetir: () => void;
  onPausar: () => void;
  onDisparar: (chave: ChaveCenario) => void;
  onTentarNovamente?: () => void;
  onUsarSimulador?: () => void;
}

/** Telas de Monitoramento: Gerencia estado de conexão (Iniciando, Ativo, Erro de Câmera e Caminho Livre/Alerta). */
export function TelaMonitor({
  fase,
  modo,
  mensagemEstado,
  cenario,
  metricas,
  onRepetir,
  onPausar,
  onDisparar,
  onTentarNovamente,
  onUsarSimulador,
}: Props) {
  const tituloRef = useFocoNoTitulo();

  // 1. Estado de Conexão: Carregando Modelo e Aguardando Permissão da Câmera
  if (fase === "iniciando") {
    return (
      <>
        <CartaoRadar
          variante="info"
          icone="…"
          titulo="Iniciando Câmera e IA"
          descricao={mensagemEstado || "Carregando o detector de IA e conectando à câmera."}
          meta="Aguardando autorização do navegador..."
          aoVivo="polite"
          tituloRef={tituloRef}
        />
        <div className="flex flex-col gap-3.5">
          <Botao id="botao-cancelar-inicio" onClick={onPausar}>
            Cancelar
          </Botao>
        </div>
      </>
    );
  }

  // 2. Estado de Conexão: Falha na Câmera ou Permissão Negada
  if (fase === "erro") {
    return (
      <>
        <CartaoRadar
          variante="perigo"
          icone="!"
          titulo="Acesso Bloqueado ou Falha"
          descricao={mensagemEstado || "Não foi possível acessar a câmera do dispositivo."}
          meta="Permita o acesso à câmera nas configurações ou utilize o modo simulador."
          aoVivo="assertive"
          tituloRef={tituloRef}
        />
        <div className="flex flex-col gap-3.5">
          {onTentarNovamente && (
            <Botao id="botao-tentar-camera" variante="primario" onClick={onTentarNovamente}>
              Tentar Novamente
            </Botao>
          )}
          {onUsarSimulador && (
            <Botao id="botao-alternar-simulador" onClick={onUsarSimulador}>
              Mudar para Modo Simulador
            </Botao>
          )}
          <Botao id="botao-voltar-erro" onClick={onPausar}>
            Voltar ao Início
          </Botao>
        </div>
      </>
    );
  }

  // 3. Estado Ativo: Monitoramento em Tempo Real (Caminho Livre ou Alerta)
  return (
    <>
      <CartaoRadar
        variante={cenario.perigo ? "perigo" : "seguro"}
        icone={cenario.icone}
        titulo={cenario.titulo}
        descricao={cenario.descricao}
        meta={cenario.meta}
        aoVivo="assertive"
        tituloRef={tituloRef}
      />

      {modo === "real" && metricas && (
        <div className="flex items-center justify-between rounded-xl border border-[#333] bg-superficie px-4 py-2 text-xs font-bold text-texto-suave">
          <span>FPS: <strong className="text-acao">{metricas.fps.toFixed(1)}</strong></span>
          <span>Inferência: <strong className="text-acao">{metricas.msInferencia.toFixed(0)} ms</strong></span>
          <span>Backend: <strong className="text-acao">{metricas.backend}</strong></span>
        </div>
      )}

      <div className="flex flex-col gap-3.5 md:flex-row md:items-stretch">
        <Botao id="botao-repetir" onClick={onRepetir} className="md:flex-1">
          Ouvir Alerta Novamente
        </Botao>
        <Botao id="botao-pausar" variante="perigo" onClick={onPausar} className="md:flex-1">
          Pausar Câmera
        </Botao>
      </div>

      <BarraSimulador onDisparar={onDisparar} />
    </>
  );
}
