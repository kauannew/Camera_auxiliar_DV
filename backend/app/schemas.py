"""Esquemas de entrada e saída da API (Pydantic v2)."""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer


class DeteccaoEntrada(BaseModel):
    id: UUID
    classe: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=50)]
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    precisao_gps: float | None = Field(default=None, ge=0)
    confianca: float = Field(ge=0, le=1)
    timestamp: datetime


class ObstaculoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    classe: str
    lat: float
    lng: float
    confirmacoes: int
    confianca_media: float
    primeira_vez: datetime
    ultima_vez: datetime

    @field_serializer("primeira_vez", "ultima_vez")
    def _em_utc(self, valor: datetime) -> str:
        # o banco guarda UTC sem fuso; devolvemos ISO 8601 com o fuso explícito
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=timezone.utc)
        return valor.isoformat().replace("+00:00", "Z")


class RespostaDeteccoes(BaseModel):
    recebidas: int
    novas: int
    duplicadas: int
    obstaculos: list[ObstaculoSaida]
