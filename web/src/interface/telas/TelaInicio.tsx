import { Botao } from "../componentes/Botao";
import { CartaoRadar } from "../componentes/CartaoRadar";
import type { ModoDetector } from "../useSentinela";
import { useFocoNoTitulo } from "../useFocoNoTitulo";

interface Props {
  modo: ModoDetector;
  onIniciar: () => void;
  onConfig: () => void;
  onAlternarModo?: () => void;
}

export function TelaInicio({ modo, onIniciar, onConfig, onAlternarModo }: Props) {
  const tituloRef = useFocoNoTitulo();
  return (
    <>
      <CartaoRadar
        variante="info"
        icone="i"
        titulo="Sistema Pronto"
        descricao="Posicione a câmera auxiliar na altura do peito ou boné."
        meta="Toque no botão amarelo abaixo para iniciar."
        aoVivo="polite"
        tituloRef={tituloRef}
      />

      <div className="flex flex-col gap-3.5 md:flex-row md:items-stretch">
        <Botao id="botao-iniciar" variante="primario" onClick={onIniciar} className="md:flex-[1.4]">
          Iniciar Monitoramento
        </Botao>
        <Botao id="botao-config" onClick={onConfig} className="md:flex-1">
          Configurações
        </Botao>
      </div>

      <div className="flex items-center justify-between rounded-xl border-2 border-[#333] bg-superficie px-4 py-2.5 text-sm font-bold">
        <span>
          Modo:{" "}
          <strong className="text-acao">
            {modo === "real" ? "Câmera com IA (Tempo Real)" : "Simulador (Pitch)"}
          </strong>
        </span>
        {onAlternarModo && (
          <button
            type="button"
            onClick={onAlternarModo}
            className="rounded-lg border border-acao bg-acao/10 px-3 py-1.5 text-xs font-bold uppercase text-acao transition hover:bg-acao/20"
          >
            Mudar
          </button>
        )}
      </div>
    </>
  );
}
