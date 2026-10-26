import type { Ref } from "react";

export type VarianteCartao = "info" | "seguro" | "perigo";

const cartao: Record<VarianteCartao, string> = {
  info: "border-4 border-acao bg-superficie",
  seguro: "border-4 border-seguro bg-superficie shadow-[0_0_2rem_rgba(50,215,75,0.18)]",
  perigo: "border-[6px] border-perigo bg-fundo-perigo shadow-[0_0_2.5rem_rgba(255,69,58,0.4)]",
};

const titulo: Record<VarianteCartao, string> = {
  info: "text-texto",
  seguro: "text-seguro",
  perigo: "text-acao",
};

const icone: Record<VarianteCartao, string> = {
  info: "bg-acao",
  seguro: "bg-seguro",
  perigo: "bg-acao",
};

interface Props {
  variante: VarianteCartao;
  icone: string;
  titulo: string;
  descricao: string;
  meta?: string;
  /** Anuncia mudanças ao leitor de tela. "assertive" interrompe a fala atual (usar só para alertas). */
  aoVivo?: "polite" | "assertive";
  /** Recebe o foco ao entrar na tela (orienta o leitor de tela) */
  tituloRef?: Ref<HTMLHeadingElement>;
}

/** Cartão central: estado do sistema, caminho livre ou alerta de obstáculo. */
export function CartaoRadar({ variante, icone: simbolo, titulo: texto, descricao, meta, aoVivo, tituloRef }: Props) {
  return (
    <section
      aria-live={aoVivo}
      aria-atomic={aoVivo ? true : undefined}
      className={`flex min-h-[17rem] flex-1 flex-col items-center justify-center gap-3.5 rounded-[1.25rem] p-6 text-center transition-[background-color,border-color,box-shadow] duration-200 ${cartao[variante]}`}
    >
      <div
        aria-hidden="true"
        className={`flex size-[4.5rem] items-center justify-center rounded-full text-[2.5rem] font-bold leading-none text-black ${icone[variante]}`}
      >
        {simbolo}
      </div>
      <h2 ref={tituloRef} tabIndex={-1} className={`text-[2rem] font-bold uppercase leading-[1.15] ${titulo[variante]}`}>
        {texto}
      </h2>
      <p className="text-[1.45rem] font-bold leading-snug">{descricao}</p>
      {meta && <p className="text-[1.25rem] font-bold text-acao">{meta}</p>}
    </section>
  );
}
