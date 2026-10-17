"""Regra de negócio: fundir detecções próximas num mesmo obstáculo."""
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .models import Deteccao, Obstaculo
from .repositorio import RepositorioObstaculos
from .schemas import DeteccaoEntrada


def para_utc_naive(momento: datetime) -> datetime:
    """Converte para UTC e tira o fuso (o banco guarda tudo em UTC)."""
    if momento.tzinfo is not None:
        momento = momento.astimezone(timezone.utc).replace(tzinfo=None)
    return momento


@dataclass
class ResultadoFusao:
    novas: int = 0
    duplicadas: int = 0
    # obstáculos criados ou atualizados, em ordem de primeira alteração
    afetados: dict[str, Obstaculo] = field(default_factory=dict)


def registrar_deteccoes(
    repo: RepositorioObstaculos, entradas: list[DeteccaoEntrada], raio_fusao_m: float
) -> ResultadoFusao:
    resultado = ResultadoFusao()
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    for entrada in entradas:
        # Idempotência: o mesmo id já foi processado (reenvio da fila offline)
        if repo.obter_deteccao(str(entrada.id)) is not None:
            resultado.duplicadas += 1
            continue

        momento = para_utc_naive(entrada.timestamp)
        obst = repo.buscar_mais_proximo(entrada.classe, entrada.lat, entrada.lng, raio_fusao_m)

        if obst is None:
            obst = Obstaculo(
                classe=entrada.classe,
                lat=entrada.lat,
                lng=entrada.lng,
                confirmacoes=1,
                confianca_media=entrada.confianca,
                primeira_vez=momento,
                ultima_vez=momento,
            )
            repo.adicionar(obst)
        else:
            n = obst.confirmacoes
            # média móvel: cada detecção pesa igual
            obst.lat = (obst.lat * n + entrada.lat) / (n + 1)
            obst.lng = (obst.lng * n + entrada.lng) / (n + 1)
            obst.confianca_media = (obst.confianca_media * n + entrada.confianca) / (n + 1)
            obst.confirmacoes = n + 1
            # detecções da fila offline podem chegar fora de ordem
            obst.primeira_vez = min(obst.primeira_vez, momento)
            obst.ultima_vez = max(obst.ultima_vez, momento)

        repo.adicionar(
            Deteccao(
                id=str(entrada.id),
                classe=entrada.classe,
                lat=entrada.lat,
                lng=entrada.lng,
                precisao_gps=entrada.precisao_gps,
                confianca=entrada.confianca,
                timestamp=momento,
                recebido_em=agora,
                obstaculo_id=obst.id,
            )
        )
        resultado.novas += 1
        resultado.afetados[obst.id] = obst

    return resultado
