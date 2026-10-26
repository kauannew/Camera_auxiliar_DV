/** Moldura vermelha piscante na borda da tela durante um perigo: ajuda quem tem visão residual periférica. */
export function BordaAlerta({ ativa }: { ativa: boolean }) {
  if (!ativa) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 animate-alerta border-[0.5rem] border-perigo"
    />
  );
}
