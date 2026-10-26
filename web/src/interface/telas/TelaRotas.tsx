import { useEffect } from "react";
import { Botao } from "../componentes/Botao";
import { CartaoRadar } from "../componentes/CartaoRadar";
import { MapaRota } from "../componentes/MapaRota";
import { ROTA_DEMO, type Rota } from "../rotas/apiRotas";
import { distanciaCurta, duracaoCurta } from "../rotas/formatadores";
import type { ControleRota } from "../rotas/useRota";
import { useFocoNoTitulo } from "../useFocoNoTitulo";

interface Props {
  controle: ControleRota;
}

/** Aba Rotas: rota acessível (API do Antônio) com mapa e navegação por voz passo a passo. */
export function TelaRotas({ controle }: Props) {
  const tituloRef = useFocoNoTitulo();
  const { estado, carregar } = controle;

  // Busca na primeira vez que a aba abre; ao voltar de outra aba, reaproveita a rota já carregada
  useEffect(() => {
    if (estado.status === "ocioso") void carregar();
  }, [estado.status, carregar]);

  return (
    <>
      <div>
        <h2 ref={tituloRef} tabIndex={-1} className="text-[1.75rem] font-bold uppercase leading-tight">
          Rota Acessível
        </h2>
        <p className="mt-1 text-[1.1rem] text-texto-suave">
          De <strong className="text-texto">{ROTA_DEMO.nomeOrigem}</strong> até{" "}
          <strong className="text-texto">{ROTA_DEMO.nomeDestino}</strong>{" "}
          <span className="whitespace-nowrap">(trajeto de demonstração)</span>
        </p>
      </div>

      {(estado.status === "ocioso" || estado.status === "carregando") && (
        <CartaoRadar
          variante="info"
          icone="…"
          titulo="Calculando rota"
          descricao="Buscando o caminho acessível mais seguro."
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
