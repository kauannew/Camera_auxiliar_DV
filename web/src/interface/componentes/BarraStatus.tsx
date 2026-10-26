interface Props {
  texto: string;
  perigo: boolean;
}

/** Faixa de status. `role="status"` (polite): não disputa com o alerta assertivo do cartão. */
export function BarraStatus({ texto, perigo }: Props) {
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-[0.625rem] border-2 px-3.5 py-2.5 text-[1.15rem] font-bold transition-colors duration-200 ${
        perigo ? "border-perigo bg-fundo-perigo text-acao" : "border-seguro bg-superficie text-texto"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-3.5 shrink-0 rounded-full ${perigo ? "bg-perigo" : "bg-seguro"}`}
      />
      <span>{texto}</span>
    </div>
  );
}
