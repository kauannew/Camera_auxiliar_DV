"""Popula o banco com buracos de exemplo em Recife-PE.

Uso:
    python -m app.seed          # insere os pontos que ainda não existem (idempotente)
    python -m app.seed --reset  # apaga TODOS os obstáculos e detecções e reinsere
"""
import argparse
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from .config import Configuracoes
from .db import Base, criar_engine, criar_fabrica_sessoes
from .models import Deteccao, Obstaculo

# Namespace fixo: o mesmo ponto sempre gera o mesmo id, então rodar duas vezes não duplica
NAMESPACE_SEED = uuid.UUID("6f1c2a5e-8b1d-4c3e-9a7f-2d4b5e6f7a80")

# (bairro/via, lat, lng, confirmações)
PONTOS = [
    # Av. Conde da Boa Vista
    ("Av. Conde da Boa Vista, perto da Rua do Hospício", -8.06005, -34.88830, 12),
    ("Av. Conde da Boa Vista, em frente ao shopping", -8.06030, -34.89010, 9),
    ("Av. Conde da Boa Vista, parada de ônibus", -8.06052, -34.89175, 6),
    ("Av. Conde da Boa Vista, cruzamento com Rua da Soledade", -8.06075, -34.89340, 4),
    ("Av. Conde da Boa Vista, calçada lado sul", -8.06100, -34.89520, 2),
    ("Av. Conde da Boa Vista, perto da Rua Gervásio Pires", -8.06120, -34.89700, 1),
    # Boa Vista
    ("Boa Vista, Rua da Imperatriz", -8.06215, -34.88250, 7),
    ("Boa Vista, Rua Nova", -8.06290, -34.88160, 3),
    ("Boa Vista, Rua do Hospício", -8.05820, -34.88690, 5),
    ("Boa Vista, Praça Maciel Pinheiro", -8.05960, -34.88310, 1),
    ("Boa Vista, Rua da Matriz", -8.05880, -34.88480, 2),
    ("Boa Vista, Rua Sete de Setembro", -8.06110, -34.88560, 8),
    # Rua da Aurora
    ("Rua da Aurora, em frente ao Ginásio Pernambucano", -8.05690, -34.88020, 10),
    ("Rua da Aurora, perto da Ponte Duarte Coelho", -8.06000, -34.87960, 4),
    ("Rua da Aurora, perto da Ponte da Boa Vista", -8.06240, -34.87920, 1),
    ("Rua da Aurora, trecho norte", -8.05480, -34.88080, 2),
    ("Rua da Aurora, calçada do rio", -8.05850, -34.87985, 6),
    # Recife Antigo
    ("Recife Antigo, Rua do Bom Jesus", -8.06190, -34.87140, 11),
    ("Recife Antigo, Marco Zero", -8.06310, -34.87110, 3),
    ("Recife Antigo, Rua da Moeda", -8.06420, -34.87260, 5),
    ("Recife Antigo, Av. Rio Branco", -8.06350, -34.87380, 1),
    ("Recife Antigo, Rua do Apolo", -8.05990, -34.87230, 2),
    ("Recife Antigo, Cais da Alfândega", -8.06480, -34.87330, 7),
    # Derby
    ("Derby, Praça do Derby", -8.05720, -34.89880, 9),
    ("Derby, Av. Agamenon Magalhães", -8.05510, -34.89960, 4),
    ("Derby, Rua do Paissandu", -8.05930, -34.89760, 1),
    ("Derby, Av. Governador Agamenon perto do hospital", -8.05350, -34.90010, 3),
    ("Derby, Rua Amélia", -8.05640, -34.90120, 2),
]


def gerar_obstaculos(agora: datetime) -> list[Obstaculo]:
    aleatorio = random.Random(42)  # semente fixa: mesma saída toda vez
    obstaculos = []
    for nome, lat, lng, confirmacoes in PONTOS:
        primeira = agora - timedelta(days=aleatorio.uniform(3, 30))
        # quanto mais confirmações, mais recente tende a ser o último relato
        ultima = agora - timedelta(hours=aleatorio.uniform(0.5, 72 / confirmacoes))
        obstaculos.append(
            Obstaculo(
                id=str(uuid.uuid5(NAMESPACE_SEED, nome)),
                classe="buraco",
                lat=lat,
                lng=lng,
                confirmacoes=confirmacoes,
                confianca_media=round(aleatorio.uniform(0.55, 0.93), 3),
                primeira_vez=primeira,
                ultima_vez=max(ultima, primeira),
            )
        )
    return obstaculos


def main() -> None:
    parser = argparse.ArgumentParser(description="Popula o banco com buracos de exemplo em Recife.")
    parser.add_argument("--reset", action="store_true", help="apaga todos os dados antes de inserir")
    args = parser.parse_args()

    config = Configuracoes()
    engine = criar_engine(config.database_url)
    Base.metadata.create_all(engine)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    with criar_fabrica_sessoes(engine)() as sessao:
        if args.reset:
            sessao.execute(delete(Deteccao))
            sessao.execute(delete(Obstaculo))
        inseridos = 0
        for obst in gerar_obstaculos(agora):
            if sessao.get(Obstaculo, obst.id) is None:
                sessao.add(obst)
                inseridos += 1
        sessao.commit()

    print(f"Seed concluído: {inseridos} obstáculos inseridos ({len(PONTOS) - inseridos} já existiam).")
    print(f"Banco: {config.database_url}")


if __name__ == "__main__":
    main()
