import { useEffect, useRef } from "react";

/** Ao entrar numa tela, leva o foco ao título: o leitor de tela anuncia onde o usuário está. */
export function useFocoNoTitulo() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
