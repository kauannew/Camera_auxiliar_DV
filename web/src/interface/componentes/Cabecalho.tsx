import { BarraStatus } from "./BarraStatus";

interface Props {
  textoStatus: string;
  perigo: boolean;
}

export function Cabecalho({ textoStatus, perigo }: Props) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-[1.75rem] font-bold uppercase tracking-wide text-acao">Sentinela Visual</h1>
      <BarraStatus texto={textoStatus} perigo={perigo} />
      <p className="text-base text-texto-suave">Complemento da bengala. Nunca a substitui.</p>
    </header>
  );
}
