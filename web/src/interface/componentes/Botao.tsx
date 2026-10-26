import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "perigo";

const base =
  "flex min-h-[5.5rem] w-full flex-col items-center justify-center rounded-2xl px-4 py-4 text-center text-[1.4rem] font-bold uppercase leading-tight " +
  "transition duration-100 ease-out active:scale-[0.98] disabled:opacity-50";

const variantes: Record<Variante, string> = {
  // Amarelo ação com texto preto (contraste ~14:1)
  primario: "min-h-[6.5rem] bg-acao text-[1.55rem] text-black hover:brightness-110",
  secundario: "border-[3px] border-texto bg-superficie text-texto hover:bg-[#262626]",
  // Texto preto sobre o vermelho: ~6,2:1 (o branco ficaria em ~3,4:1)
  perigo: "bg-perigo text-black hover:brightness-110",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  children: ReactNode;
}

/** Botão gigante de alto contraste (alvo de toque ≥ 88 px). */
export function Botao({ variante = "secundario", className = "", children, type = "button", ...resto }: Props) {
  return (
    <button type={type} className={`${base} ${variantes[variante]} ${className}`} {...resto}>
      {children}
    </button>
  );
}
