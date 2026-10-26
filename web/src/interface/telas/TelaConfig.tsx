import { PainelConfig } from "../componentes/PainelConfig";
import type { Configuracoes } from "../useSentinela";
import { useFocoNoTitulo } from "../useFocoNoTitulo";

interface Props {
  config: Configuracoes;
  onAlternar: (campo: "voz" | "bipes" | "vibracao") => void;
  onAlternarModo: () => void;
  onCiclarDistancia: () => void;
  onSalvar: () => void;
}

/** Tela 4 (Figma): configurações acessíveis. */
export function TelaConfig(props: Props) {
  const tituloRef = useFocoNoTitulo();
  return (
    <>
      <h2 ref={tituloRef} tabIndex={-1} className="text-[1.75rem] font-bold uppercase leading-tight">
        Configurações do Sentinela
      </h2>
      <PainelConfig {...props} />
    </>
  );
}
