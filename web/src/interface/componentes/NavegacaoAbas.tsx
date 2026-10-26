export type Aba = "radar" | "rotas";

interface Props {
  aba: Aba;
  onMudar: (aba: Aba) => void;
}

const ITENS: { aba: Aba; icone: string; rotulo: string }[] = [
  { aba: "radar", icone: "📡", rotulo: "Radar" },
  { aba: "rotas", icone: "🧭", rotulo: "Rotas" },
];

/** Abas fixas no rodapé, ao alcance do polegar. A aba atual usa aria-current e cor + preenchimento (não só cor). */
export function NavegacaoAbas({ aba, onMudar }: Props) {
  return (
    <nav
      aria-label="Seções do aplicativo"
      className="sticky bottom-0 z-40 -mx-4 grid grid-cols-2 gap-2 border-t border-[#333] bg-fundo px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8"
    >
      {ITENS.map((item) => {
        const ativa = item.aba === aba;
        return (
          <button
            key={item.aba}
            id={`aba-${item.aba}`}
            type="button"
            aria-current={ativa ? "page" : undefined}
            onClick={() => onMudar(item.aba)}
            className={`flex min-h-[4.5rem] items-center justify-center gap-2.5 rounded-2xl text-[1.3rem] font-bold uppercase transition duration-100 active:scale-[0.98] ${
              ativa ? "bg-acao text-black" : "border-[3px] border-texto bg-superficie text-texto hover:bg-[#262626]"
            }`}
          >
            <span aria-hidden="true" className="text-[1.6rem] leading-none">
              {item.icone}
            </span>
            {item.rotulo}
          </button>
        );
      })}
    </nav>
  );
}
