import { useEffect, useMemo } from "react";
import { Botao } from "../componentes/Botao";
import { CartaoRadar } from "../componentes/CartaoRadar";
import { MapaRota } from "../componentes/MapaRota";
import { ESTADOS_DISPONIVEIS, TRAJETOS_PREDEFINIDOS, type Rota } from "../rotas/apiRotas";
import { distanciaCurta, duracaoCurta } from "../rotas/formatadores";
import type { ControleRota } from "../rotas/useRota";
import { useFocoNoTitulo } from "../useFocoNoTitulo";

interface Props {
  controle: ControleRota;
}

/** Aba Rotas: rota acessível (API do Antônio) com mapa, seletores por Estado/Cidade e GPS em tempo real. */
export function TelaRotas({ controle }: Props) {
  const tituloRef = useFocoNoTitulo();
  const {
    estado,
    carregar,
    origemSelecionada,
    trajetoId,
    infoTrajeto,
    selecionarOrigem,
    selecionarTrajeto,
  } = controle;

  // Busca na primeira vez que a aba abre; ao voltar de outra aba, reaproveita a rota já carregada
  useEffect(() => {
    if (estado.status === "ocioso") void carregar();
  }, [estado.status, carregar]);

  const trajetosDoEstado = useMemo(() => {
    return TRAJETOS_PREDEFINIDOS.filter((t) => t.estado === origemSelecionada);
  }, [origemSelecionada]);

  return (
    <>
      <div>
        <h2 ref={tituloRef} tabIndex={-1} className="text-[1.75rem] font-bold uppercase leading-tight">
          Rota Acessível
        </h2>
        <p className="mt-1 text-[1.1rem] text-texto-suave">
          De <strong className="text-texto">{infoTrajeto.nomeOrigem}</strong> até{" "}
          <strong className="text-texto">{infoTrajeto.nomeDestino}</strong>
          {infoTrajeto.detalhe && (
            <span className="block text-sm font-semibold text-acao mt-0.5">
              ✦ {infoTrajeto.detalhe}
            </span>
          )}
        </p>
      </div>

      {/* Seletor Opção B: Estado / Origem e Cidade / Trajeto */}
      <section aria-label="Seleção de Trajeto ou Localização" className="rounded-2xl border-2 border-acao/40 bg-superficie p-4 space-y-3">
        <div className="space-y-1">
          <label htmlFor="seletor-estado" className="block text-sm font-bold uppercase tracking-wide text-acao">
            1. Estado / Origem:
          </label>
          <select
            id="seletor-estado"
            value={origemSelecionada}
            onChange={(e) => selecionarOrigem(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border-2 border-acao bg-fundo px-3 py-2 text-base font-bold text-texto focus-visible:outline-white"
          >
            <option value="gps">📍 Meu Local Atual (GPS em Tempo Real)</option>
            {ESTADOS_DISPONIVEIS.map((est) => (
              <option key={est.id} value={est.id}>
                {est.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="seletor-cidade" className="block text-sm font-bold uppercase tracking-wide text-acao">
            2. Cidade e Trajeto:
          </label>
          {origemSelecionada === "gps" ? (
            <div className="flex gap-2 items-center">
              <select
                id="seletor-cidade"
                disabled
                aria-disabled="true"
                className="w-full min-h-[48px] rounded-xl border-2 border-texto-suave/30 bg-fundo/50 px-3 py-2 text-base font-medium text-texto-suave opacity-75"
              >
                <option>📍 Traçado dinâmico pelo seu GPS (~400m)</option>
              </select>
              <button
                type="button"
                onClick={() => void carregar()}
                aria-label="Atualizar localização pelo GPS"
                className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl border-2 border-acao bg-fundo text-acao font-bold hover:bg-acao hover:text-fundo transition-colors focus-visible:outline-white"
                title="Atualizar GPS"
              >
                🔄
              </button>
            </div>
          ) : (
            <select
              id="seletor-cidade"
              value={trajetoId}
              onChange={(e) => selecionarTrajeto(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border-2 border-acao bg-fundo px-3 py-2 text-base font-bold text-texto focus-visible:outline-white"
            >
              {trajetosDoEstado.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nomeCidade} · {t.titulo}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {(estado.status === "ocioso" || estado.status === "carregando") && (
        <CartaoRadar
          variante="info"
          icone="…"
          titulo="Calculando rota"
          descricao={estado.status === "carregando" && estado.mensagem ? estado.mensagem : "Buscando o caminho acessível mais seguro."}
          aoVivo="polite"
        />
      )}

      {estado.status === "erro" && (
        <>
          <CartaoRadar
            variante="perigo"
            icone="!"
            titulo="Rota indisponível"
            descricao={estado.mensagem}
            aoVivo="assertive"
          />
          <Botao id="botao-tentar-novamente" variante="primario" onClick={() => void carregar()}>
            Tentar novamente
          </Botao>
        </>
      )}

      {estado.status === "pronta" && <RotaPronta rota={estado.rota} controle={controle} />}
    </>
  );
}

function RotaPronta({ rota, controle }: { rota: Rota; controle: ControleRota }) {
  const { passoAtual, lendo, ouvirTudo, pararLeitura, proximo, anterior, repetir, irParaPasso } = controle;
  const total = rota.passos.length;
  const passo = passoAtual !== null ? rota.passos[passoAtual] : null;

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Indicador rotulo="Distância" valor={distanciaCurta(rota.distanciaM)} />
        <Indicador rotulo="Tempo" valor={duracaoCurta(rota.duracaoS)} />
        <Indicador
          rotulo={rota.obstaculosEvitados === 1 ? "Obstáculo evitado" : "Obstáculos evitados"}
          valor={String(rota.obstaculosEvitados)}
          destaque={rota.obstaculosEvitados > 0}
        />
      </dl>

      <MapaRota rota={rota} />
      <p className="-mt-1 text-center text-base text-texto-suave">
        <span aria-hidden="true">🟢</span> Origem · <span aria-hidden="true">🔴</span> Destino · Linha amarela: rota
      </p>

      {total > 0 && (
        <>
          <Botao
            id="botao-ouvir-trajeto"
            variante={lendo ? "perigo" : "primario"}
            onClick={lendo ? pararLeitura : ouvirTudo}
          >
            {lendo ? "Parar Leitura" : "Ouvir Trajeto Completo"}
          </Botao>

          <section aria-label="Passo atual" className="rounded-2xl border-4 border-acao bg-superficie p-5">
            <p className="text-[1.1rem] font-bold uppercase text-acao">
              {passo ? `Passo ${passoAtual! + 1} de ${total}` : `${total} passos`}
            </p>
            <p className="mt-1 text-[1.6rem] font-bold leading-snug">
              {passo ? passo.texto : "Toque em “Próximo passo” para ouvir o caminho um trecho de cada vez."}
            </p>
            {passo && (
              <p className="mt-1 text-[1.25rem] font-bold text-acao">
                {passo.distanciaM > 0 ? `Siga por ${distanciaCurta(passo.distanciaM)}` : "Você chegou ao destino"}
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3.5">
            <Botao id="botao-passo-anterior" onClick={anterior}>
              Passo Anterior
            </Botao>
            <Botao id="botao-proximo-passo" onClick={proximo}>
              Próximo Passo
            </Botao>
            <Botao id="botao-repetir-passo" className="col-span-2" onClick={repetir}>
              Repetir Passo
            </Botao>
          </div>

          <section aria-labelledby="titulo-lista-passos">
            <h3 id="titulo-lista-passos" className="mb-2 text-[1.3rem] font-bold uppercase">
              Todos os passos
            </h3>
            <ol className="flex flex-col gap-2">
              {rota.passos.map((p, i) => {
                const atual = i === passoAtual;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={atual ? "step" : undefined}
                      onClick={() => irParaPasso(i)}
                      className={`flex min-h-16 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-[1.15rem] font-bold transition active:scale-[0.99] ${
                        atual ? "border-acao bg-acao text-black" : "border-[#444] bg-superficie text-texto hover:bg-[#262626]"
                      }`}
                    >
                      <span aria-hidden="true" className="min-w-[1.75rem] text-right">
                        {i + 1}.
                      </span>
                      <span className="flex-1">
                        {p.texto}
                        {p.distanciaM > 0 && (
                          <span className={`block text-base font-normal ${atual ? "text-black" : "text-texto-suave"}`}>
                            {distanciaCurta(p.distanciaM)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </>
  );
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`flex flex-col-reverse items-center justify-center rounded-xl border-2 px-1 py-3 ${
        destaque ? "border-seguro bg-superficie" : "border-[#444] bg-superficie"
      }`}
    >
      <dt className="text-[0.95rem] leading-tight text-texto-suave">{rotulo}</dt>
      <dd className={`text-[1.6rem] font-bold leading-none ${destaque ? "text-seguro" : "text-texto"}`}>{valor}</dd>
    </div>
  );
}
