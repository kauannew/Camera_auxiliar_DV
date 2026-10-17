"""Conexão com o banco (SQLAlchemy 2)."""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def criar_engine(database_url: str) -> Engine:
    if database_url.startswith("sqlite"):
        engine = create_engine(database_url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _pragmas_sqlite(conexao, _registro):
            cursor = conexao.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

        return engine
    return create_engine(database_url, pool_pre_ping=True)


def criar_fabrica_sessoes(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)
