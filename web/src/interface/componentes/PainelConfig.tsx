import { BotaoAlternar } from "./BotaoAlternar";
import { Botao } from "./Botao";
import { formatarDistancia, type Configuracoes } from "../useSentinela";

interface Props {
  config: Configuracoes;
  onAlternar: (campo: "voz" | "bipes" | "vibracao") => void;
  onAlternarModo: () => void;
  onCiclarDistancia: () => void;
  onSalvar: () => void;
}

export function PainelConfig({ config, onAlternar, onAlternarModo, onCiclarDistancia, onSalvar }: Props) {
  return (
    <>
      <div className="flex flex-col gap-3.5">
        <BotaoAlternar
          id="alternar-modo"
          rotulo="Modo de Operação"
          estado={config.modo === "real" ? "Câmera com IA (Tempo Real)" : "Simulador (Pitch / Apresentação)"}
          ligado={config.modo === "real"}
          onClick={onAlternarModo}
        />
        <BotaoAlternar
          id="alternar-voz"
          rotulo="Voz Nativa do Aplicativo"
          estado={config.voz ? "Ativada (recomendado)" : "Desativada"}
          ligado={config.voz}
          onClick={() => onAlternar("voz")}
        />
        <BotaoAlternar
          id="alternar-bipes"
          rotulo="Bipes Sonoros de Alerta"
          estado={config.bipes ? "Ativados" : "Desativados"}
          ligado={config.bipes}
          onClick={() => onAlternar("bipes")}
        />
        <BotaoAlternar
          id="alternar-vibracao"
          rotulo="Vibração de Perigo"
          estado={config.vibracao ? "Intensa" : "Desativada"}
          ligado={config.vibracao}
          onClick={() => onAlternar("vibracao")}
        />
        <BotaoAlternar
          id="ciclar-distancia"
          rotulo="Distância de Aviso (toque para alterar)"
          estado={formatarDistancia(config.distanciaAvisoM)}
          onClick={onCiclarDistancia}
        />
      </div>
      <Botao id="salvar-config" variante="primario" onClick={onSalvar}>
        Salvar e Voltar
      </Botao>
    </>
  );
}
