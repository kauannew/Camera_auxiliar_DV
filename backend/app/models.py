"""Modelos do banco: detecções (dado bruto) e obstáculos (pontos fundidos)."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# Todas as datas são guardadas em UTC, sem fuso (naive), para funcionar igual no SQLite.


class Obstaculo(Base):
    __tablename__ = "obstaculos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    classe: Mapped[str] = mapped_column(String(50))
    lat: Mapped[float] = mapped_column(Float)  # média móvel das detecções
    lng: Mapped[float] = mapped_column(Float)
    confirmacoes: Mapped[int] = mapped_column(Integer, default=1)
    confianca_media: Mapped[float] = mapped_column(Float)
    primeira_vez: Mapped[datetime] = mapped_column(DateTime)
    ultima_vez: Mapped[datetime] = mapped_column(DateTime)

    deteccoes: Mapped[list["Deteccao"]] = relationship(back_populates="obstaculo")

    __table_args__ = (
        # No PostGIS isto vira um índice GIST na coluna geography (ver repositorio.py)
        Index("ix_obstaculos_classe_lat_lng", "classe", "lat", "lng"),
    )


class Deteccao(Base):
    __tablename__ = "deteccoes"

    # uuid gerado no celular: reenviar o mesmo id não duplica nada (idempotência)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    classe: Mapped[str] = mapped_column(String(50))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    precisao_gps: Mapped[float | None] = mapped_column(Float, nullable=True)
    confianca: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime)
    recebido_em: Mapped[datetime] = mapped_column(DateTime)
    obstaculo_id: Mapped[str] = mapped_column(ForeignKey("obstaculos.id"), index=True)

    obstaculo: Mapped[Obstaculo] = relationship(back_populates="deteccoes")
