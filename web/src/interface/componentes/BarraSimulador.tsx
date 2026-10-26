import { SIMULADOR, type ChaveCenario } from "../cenarios";

interface Props {
  onDisparar: (chave: ChaveCenario) => void;
}

/** Simulador de eventos da câmera para a apresentação aos jurados. Atalhos de teclado: 1 a 4. */
export function BarraSimulador({ onDisparar }: Props) {
  return (
    <aside aria-label="Simulador de eventos para apresentação" className="mt-2 border-t border-dashed border-[#444] pt-3">
      <p className="mb-2 text-center text-sm uppercase text-texto-suave">
        Simulador da câmera (demonstração no pitch)
        <span className="hidden md:inline"> · atalhos 1 a 4</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SIMULADOR.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => onDisparar(item.chave)}
            className="min-h-14 rounded-lg border border-[#555] bg-[#222] px-2 py-2.5 text-[0.95rem] font-bold text-acao transition hover:bg-[#333] active:scale-[0.98]"
          >
            {item.rotulo}
          </button>
        ))}
      </div>
    </aside>
  );
}
