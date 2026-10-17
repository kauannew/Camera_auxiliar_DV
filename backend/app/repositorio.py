"""Camada de repositório: isola as consultas (principalmente a espacial).

Hoje roda em SQLite com filtro por bbox + haversine em Python. Para migrar para
PostgreSQL + PostGIS basta reimplementar esta classe; o resto do código não muda.

Equivalente em PostGIS (com coluna `geom geography(Point, 4326)` e índice GIST):

    -- obstáculo mais próximo da mesma classe dentro do raio
    SELECT *, ST_Distance(geom, ST_MakePoint(:lng, :lat)::geography) AS dist
    FROM obstaculos
    WHERE classe = :classe
      AND ST_DWithin(geom, ST_MakePoint(:lng, :lat)::geography, :raio_m)
    ORDER BY dist
    LIMIT 1;

    -- obstáculos dentro do retângulo visível do mapa
    SELECT * FROM obstaculos
    WHERE geom && ST_MakeEnvelope(:min_lng, :min_lat, :max_lng, :max_lat, 4326)::geography;
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .geo import bbox_em_graus, haversine_m
from .models import Deteccao, Obstaculo


class RepositorioObstaculos:
    def __init__(self, sessao: Session):
        self.sessao = sessao

    def buscar_mais_proximo(
        self, classe: str, lat: float, lng: float, raio_m: float
    ) -> Obstaculo | None:
        """Obstáculo da mesma classe mais próximo de (lat, lng) dentro de raio_m."""
        min_lat, min_lng, max_lat, max_lng = bbox_em_graus(lat, lng, raio_m)
        candidatos = self.sessao.scalars(
            select(Obstaculo).where(
                Obstaculo.classe == classe,
                Obstaculo.lat.between(min_lat, max_lat),
                Obstaculo.lng.between(min_lng, max_lng),
            )
        ).all()
        melhor, melhor_dist = None, raio_m
        for obst in candidatos:
            dist = haversine_m(lat, lng, obst.lat, obst.lng)
            if dist <= melhor_dist:
                melhor, melhor_dist = obst, dist
        return melhor

    def listar_na_bbox(
        self,
        min_lng: float,
        min_lat: float,
        max_lng: float,
        max_lat: float,
        classe: str | None = None,
        min_confirmacoes: int = 1,
        limite: int = 2000,
    ) -> list[Obstaculo]:
        consulta = select(Obstaculo).where(
            Obstaculo.lat.between(min_lat, max_lat),
            Obstaculo.lng.between(min_lng, max_lng),
            Obstaculo.confirmacoes >= min_confirmacoes,
        )
        if classe:
            consulta = consulta.where(Obstaculo.classe == classe)
        consulta = consulta.order_by(Obstaculo.confirmacoes.desc()).limit(limite)
        return list(self.sessao.scalars(consulta).all())

    def obter_deteccao(self, id_deteccao: str) -> Deteccao | None:
        return self.sessao.get(Deteccao, id_deteccao)

    def obter_obstaculo(self, id_obstaculo: str) -> Obstaculo | None:
        return self.sessao.get(Obstaculo, id_obstaculo)

    def adicionar(self, objeto: Obstaculo | Deteccao) -> None:
        self.sessao.add(objeto)
        # flush para que a próxima detecção do mesmo lote já enxergue este ponto
        self.sessao.flush()
