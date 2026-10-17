"""Funções geográficas simples (sem dependências)."""
import math

METROS_POR_GRAU_LAT = 111_320.0
RAIO_TERRA_M = 6_371_000.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distância em metros entre dois pontos (lat/lng em graus)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * RAIO_TERRA_M * math.asin(math.sqrt(a))


def bbox_em_graus(lat: float, lng: float, raio_m: float) -> tuple[float, float, float, float]:
    """Caixa (min_lat, min_lng, max_lat, max_lng) de ±raio_m em volta do ponto."""
    dlat = raio_m / METROS_POR_GRAU_LAT
    # cos(lat) nunca é zero na prática (só nos polos); o max evita divisão por zero
    dlng = raio_m / (METROS_POR_GRAU_LAT * max(math.cos(math.radians(lat)), 1e-6))
    return lat - dlat, lng - dlng, lat + dlat, lng + dlng
