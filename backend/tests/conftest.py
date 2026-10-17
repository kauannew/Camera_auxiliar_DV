import pytest
from fastapi.testclient import TestClient

from app.config import Configuracoes
from app.main import criar_app


@pytest.fixture
def cliente(tmp_path):
    config = Configuracoes(
        database_url=f"sqlite:///{(tmp_path / 'teste.db').as_posix()}",
        raio_fusao_m=5.0,
        web_dist=tmp_path / "sem_web",
    )
    with TestClient(criar_app(config)) as c:
        yield c


@pytest.fixture
def cliente_com_web(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>PWA</title>", encoding="utf-8")
    (dist / "assets" / "ort.wasm").write_bytes(b"\0asm")
    (dist / "modelo.onnx").write_bytes(b"onnx")
    config = Configuracoes(
        database_url=f"sqlite:///{(tmp_path / 'teste.db').as_posix()}",
        web_dist=dist,
    )
    with TestClient(criar_app(config)) as c:
        yield c
