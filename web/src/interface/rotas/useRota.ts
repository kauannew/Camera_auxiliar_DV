import { useCallback, useEffect, useRef, useState } from "react";
import { falar, falarSequencia, pararFala } from "../feedback";
import {
  TRAJETOS_PREDEFINIDOS,
  buscarRota,
  gerarDestinoProximo,
  mensagemDeErro,
  obterGpsAtual,
  type DefinicaoTrajeto,
  type Rota,
} from "./apiRotas";
import { resumoFalado, textoFaladoDoPasso } from "./formatadores";

export type EstadoRota =
  | { status: "ocioso" }
  | { status: "carregando"; mensagem?: string }
  | { status: "erro"; mensagem: string }
  | { status: "pronta"; rota: Rota };

export interface InfoTrajetoAtual {
  nomeOrigem: string;
  nomeDestino: string;
  detalhe?: string;
  ehGps?: boolean;
}

/**
 * Estado da rota e da navegação por voz. Vive no App (não na tela), então a rota e a leitura
 * continuam quando o usuário volta para o Radar: ouvir o trajeto e o radar ao mesmo tempo é o uso real.
 *
 * Suporta seleção hierárquica por Estado (BA, PE, SP) ou GPS em tempo real.
 */
export function useRota(vozAtiva: boolean) {
  const [estado, setEstado] = useState<EstadoRota>({ status: "ocioso" });
  const [passoAtual, setPassoAtual] = useState<number | null>(null);
  const [lendo, setLendo] = useState(false);

  // Seleção atual
  const [origemSelecionada, setOrigemSelecionada] = useState<string>("BA");
  const [trajetoId, setTrajetoId] = useState<string>("salvador-pelourinho");
  const [infoTrajeto, setInfoTrajeto] = useState<InfoTrajetoAtual>({
    nomeOrigem: "Pelourinho, Salvador (BA)",
    nomeDestino: "Rua das Portas do Carmo",
    detalhe: "Desvio de obstáculo ativo",
    ehGps: false,
  });

  const vozRef = useRef(vozAtiva);
  const abortRef = useRef<AbortController | null>(null);
  const rotaRef = useRef<Rota | null>(null);

  useEffect(() => {
    vozRef.current = vozAtiva;
  }, [vozAtiva]);

  const carregarTrajetoFixo = useCallback(async (trajeto: DefinicaoTrajeto) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    rotaRef.current = null;
    setPassoAtual(null);
    setInfoTrajeto({
      nomeOrigem: trajeto.nomeOrigem,
      nomeDestino: trajeto.nomeDestino,
      detalhe: trajeto.descricaoDestaque,
      ehGps: false,
    });
    setEstado({ status: "carregando", mensagem: `Calculando rota acessível em ${trajeto.nomeCidade}...` });

    try {
      const rota = await buscarRota(trajeto.origem, trajeto.destino, ctrl.signal);
      if (ctrl.signal.aborted) return;
      rotaRef.current = rota;
      setEstado({ status: "pronta", rota });
      if (vozRef.current) falar(resumoFalado(rota));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setEstado({ status: "erro", mensagem: mensagemDeErro(e) });
    }
  }, []);

  const carregarViaGps = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    rotaRef.current = null;
    setPassoAtual(null);
    setInfoTrajeto({
      nomeOrigem: "Meu Local Atual (GPS)",
      nomeDestino: "Destino Acessível (~400m à frente)",
      detalhe: "Caminho calculado a partir da sua posição física",
      ehGps: true,
    });
    setEstado({ status: "carregando", mensagem: "Obtendo localização pelo GPS..." });

    if (vozRef.current) {
      falar("Obtendo localização pelo GPS...");
    }

    try {
      const coords = await obterGpsAtual();
      if (ctrl.signal.aborted) return;

      setEstado({ status: "carregando", mensagem: "Calculando rota a partir do seu GPS..." });
      const destino = gerarDestinoProximo(coords, 400);

      const rota = await buscarRota(coords, destino, ctrl.signal);
      if (ctrl.signal.aborted) return;
      rotaRef.current = rota;
      setEstado({ status: "pronta", rota });
      if (vozRef.current) falar(resumoFalado(rota));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = mensagemDeErro(e);
      setEstado({ status: "erro", mensagem: msg });
      if (vozRef.current) falar(`Erro ao obter GPS: ${msg}`);
    }
  }, []);

  const selecionarOrigem = useCallback(
    (origem: string) => {
      setOrigemSelecionada(origem);
      if (origem === "gps") {
        void carregarViaGps();
      } else {
        const primeiro = TRAJETOS_PREDEFINIDOS.find((t) => t.estado === origem);
        if (primeiro) {
          setTrajetoId(primeiro.id);
          void carregarTrajetoFixo(primeiro);
        }
      }
    },
    [carregarViaGps, carregarTrajetoFixo],
  );

  const selecionarTrajeto = useCallback(
    (id: string) => {
      const trajeto = TRAJETOS_PREDEFINIDOS.find((t) => t.id === id);
      if (trajeto) {
        setTrajetoId(trajeto.id);
        void carregarTrajetoFixo(trajeto);
      }
    },
    [carregarTrajetoFixo],
  );

  const carregar = useCallback(async () => {
    if (origemSelecionada === "gps") {
      await carregarViaGps();
    } else {
      const trajeto = TRAJETOS_PREDEFINIDOS.find((t) => t.id === trajetoId) ?? TRAJETOS_PREDEFINIDOS[0];
      await carregarTrajetoFixo(trajeto);
    }
  }, [origemSelecionada, trajetoId, carregarViaGps, carregarTrajetoFixo]);

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
    falar(textoFaladoDoPasso(passos[alvo]));
  }, []);

  const proximo = useCallback(() => irParaPasso(passoAtual === null ? 0 : passoAtual + 1), [irParaPasso, passoAtual]);
  const anterior = useCallback(() => irParaPasso(passoAtual === null ? 0 : passoAtual - 1), [irParaPasso, passoAtual]);
  const repetir = useCallback(() => irParaPasso(passoAtual ?? 0), [irParaPasso, passoAtual]);

  return {
    estado,
    passoAtual,
    lendo,
    origemSelecionada,
    trajetoId,
    infoTrajeto,
    selecionarOrigem,
    selecionarTrajeto,
    carregar,
    ouvirTudo,
    pararLeitura,
    irParaPasso,
    proximo,
    anterior,
    repetir,
  };
}

export type ControleRota = ReturnType<typeof useRota>;

