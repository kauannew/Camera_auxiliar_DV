interface Props {
  rotulo: string;
  /** Texto de estado exibido (ex.: "ATIVADA") */
  estado: string;
  /** Se informado, o botão é um interruptor (role="switch"); senão, um botão comum que alterna valores. */
  ligado?: boolean;
  onClick: () => void;
  id?: string;
}

/** Controle grande de configuração: rótulo + estado por extenso (nunca só cor ou posição). */
export function BotaoAlternar({ rotulo, estado, ligado, onClick, id }: Props) {
  const ehInterruptor = ligado !== undefined;
  return (
    <button
      id={id}
      type="button"
      role={ehInterruptor ? "switch" : undefined}
      aria-checked={ehInterruptor ? ligado : undefined}
      onClick={onClick}
      className="flex min-h-[5.75rem] w-full flex-col items-start justify-center rounded-2xl border-[3px] border-acao bg-superficie px-5 py-4 text-left transition duration-100 ease-out hover:bg-[#262626] active:scale-[0.98]"
    >
      <span className="text-[1.3rem] font-bold">{rotulo}</span>
      <span className="mt-1 text-[1.15rem] font-bold uppercase text-acao">Estado: {estado}</span>
    </button>
  );
}
