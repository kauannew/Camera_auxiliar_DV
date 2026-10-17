"""Configurações do backend, lidas de variáveis de ambiente."""
import os
from dataclasses import dataclass, field
from pathlib import Path

PASTA_BACKEND = Path(__file__).resolve().parent.parent


def _float_env(nome: str, padrao: float) -> float:
    valor = os.getenv(nome)
    return float(valor) if valor else padrao


@dataclass
class Configuracoes:
    # SQLite no MVP; depois algo como postgresql+psycopg://usuario:senha@host/banco
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL", f"sqlite:///{(PASTA_BACKEND / 'camera_dv.db').as_posix()}"
        )
    )
    # Distância máxima (metros) para fundir uma detecção num obstáculo existente
    raio_fusao_m: float = field(default_factory=lambda: _float_env("RAIO_FUSAO_M", 5.0))
    # Pasta com o build do PWA (Vite)
    web_dist: Path = field(
        default_factory=lambda: Path(
            os.getenv("WEB_DIST", str(PASTA_BACKEND.parent / "web" / "dist"))
        )
    )
    # Tamanho máximo de um lote enviado pela fila offline
    max_lote: int = 500
