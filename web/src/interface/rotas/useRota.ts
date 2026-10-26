import { useCallback, useEffect, useRef, useState } from "react";
import { falar, falarSequencia, pararFala } from "../feedback";
import { ROTA_DEMO, buscarRota, mensagemDeErro, type Rota } from "./apiRotas";
import { resumoFalado, textoFaladoDoPasso } from "./formatadores";

export type EstadoRota =
  | { status: "ocioso" }
  | { status: "carregando" }
  | { status: "erro"; mensagem: string }
  | { status: "pronta"; rota: Rota };

/**
 * Estado da rota e da navegação por voz. Vive no App (não na tela), então a rota e a leitura
 * continuam quando o usuário volta para o Radar: ouvir o trajeto e o radar ao mesmo tempo é o uso real.
 *
 * `vozAtiva` só controla o anúncio automático da rota calculada. Botões de "ouvir" falam sempre,
 * porque o usuário pediu explicitamente.
 */
export function useRota(vozAtiva: boolean) {
  const [estado, setEstado] = useState<EstadoRota>({ status: "ocioso" });
  const [passoAtual, setPassoAtual] = useState<number | null>(null);
  const [lendo, setLendo] = useState(false);

  const vozRef = useRef(vozAtiva);
  const abortRef = useRef<AbortController | null>(null);
  const rotaRef = useRef<Rota | null>(null);
  useEffect(() => {
    vozRef.current = vozAtiva;
  }, [vozAtiva]);

  const carregar = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    rotaRef.current = null;
    setPassoAtual(null);
    setEstado({ status: "carregando" });
    try {
      const rota = await buscarRota(ROTA_DEMO.origem, ROTA_DEMO.destino, ctrl.signal);
      if (ctrl.signal.aborted) return;
      rotaRef.current = rota;
      setEstado({ status: "pronta", rota });
      if (vozRef.current) falar(resumoFalado(rota));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setEstado({ status: "erro", mensagem: mensagemDeErro(e) });
    }
  }, []);

  // Ao desmontar o App (recarregar a página), cancela requisição e fala
  useEffect(
    () => () => {
      abortRef.current?.abort();
      pararFala();
    },
    [],
  );

  const ouvirTudo = useCallback(() => {
    const passos = rotaRef.current?.passos;
    if (!passos?.length) return;
    const ok = falarSequencia(passos.map(textoFaladoDoPasso), {
      inicio: 0,
      aoIniciarItem: setPassoAtual,
      aoTerminar: () => setLendo(false),
    });
    setLendo(ok);
  }, []);

  const pararLeitura = useCallback(() => {
    pararFala();
    setLendo(false);
  }, []);

  const irParaPasso = useCallback((i: number) => {
    const passos = rotaRef.current?.passos;
    if (!passos?.length) return;
    const alvo = Math.min(Math.max(i, 0), passos.length - 1);
    setPassoAtual(alvo);
    falar(textoFaladoDoPasso(passos[alvo])); // falar() encerra a leitura em sequência, se houver
  }, []);

  // `passoAtual` é lido do estado atual; os botões chamam estas funções a partir do render mais recente
  const proximo = useCallback(() => irParaPasso(passoAtual === null ? 0 : passoAtual + 1), [irParaPasso, passoAtual]);
  const anterior = useCallback(() => irParaPasso(passoAtual === null ? 0 : passoAtual - 1), [irParaPasso, passoAtual]);
  const repetir = useCallback(() => irParaPasso(passoAtual ?? 0), [irParaPasso, passoAtual]);

  return { estado, passoAtual, lendo, carregar, ouvirTudo, pararLeitura, irParaPasso, proximo, anterior, repetir };
}

export type ControleRota = ReturnType<typeof useRota>;
