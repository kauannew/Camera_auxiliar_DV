"""App FastAPI: API de detecções, mapa colaborativo e hospedagem do PWA."""
import mimetypes
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Configuracoes
from .db import Base, criar_engine, criar_fabrica_sessoes
from .fusao import registrar_deteccoes
from .repositorio import RepositorioObstaculos
from .schemas import DeteccaoEntrada, ObstaculoSaida, RespostaDeteccoes

PASTA_STATIC = Path(__file__).resolve().parent / "static"

# MIME corretos para o ONNX Runtime Web (o registro do Windows às vezes erra o .js)
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/octet-stream", ".onnx")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/manifest+json", ".webmanifest")

# Rotas que NÃO recebem COOP/COEP: o mapa usa Leaflet do unpkg e tiles do OSM,
# que não mandam Cross-Origin-Resource-Policy e seriam bloqueados por require-corp.
PREFIXOS_SEM_ISOLAMENTO = ("/mapa", "/obstaculos", "/deteccoes", "/saude", "/docs", "/redoc", "/openapi.json")


class ArquivosSPA(StaticFiles):
    """Arquivos estáticos com fallback para index.html (rotas do lado do cliente)."""

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as erro:
            # só cai no index.html para "páginas", não para arquivos que faltam (ex.: .onnx)
            if erro.status_code == 404 and "." not in Path(path).name:
                return await super().get_response("index.html", scope)
            raise


def criar_app(config: Configuracoes | None = None) -> FastAPI:
    config = config or Configuracoes()
    engine = criar_engine(config.database_url)
    fabrica_sessoes = criar_fabrica_sessoes(engine)

    @asynccontextmanager
    async def ciclo_de_vida(_app: FastAPI):
        Base.metadata.create_all(engine)
        yield
        engine.dispose()

    app = FastAPI(title="Câmera Auxiliar DV", version="0.1.0", lifespan=ciclo_de_vida)
    app.state.config = config
    app.state.fabrica_sessoes = fabrica_sessoes

    # Permite o PWA rodando no Vite (outra porta) falar com a API durante o desenvolvimento
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def isolamento_cross_origin(request: Request, call_next):
        resposta = await call_next(request)
        # Necessário para SharedArrayBuffer (ONNX Runtime WASM multithread) no app web
        if not request.url.path.startswith(PREFIXOS_SEM_ISOLAMENTO):
            resposta.headers["Cross-Origin-Opener-Policy"] = "same-origin"
            resposta.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        return resposta

    def obter_sessao():
        with fabrica_sessoes() as sessao:
            yield sessao

    SessaoDep = Annotated[Session, Depends(obter_sessao)]

    @app.get("/saude")
    def saude(sessao: SessaoDep):
        sessao.execute(text("SELECT 1"))
        return {"status": "ok", "raio_fusao_m": config.raio_fusao_m}

    @app.post("/deteccoes", response_model=RespostaDeteccoes)
    def receber_deteccoes(
        sessao: SessaoDep,
        corpo: Annotated[DeteccaoEntrada | list[DeteccaoEntrada], Body()],
    ):
        entradas = corpo if isinstance(corpo, list) else [corpo]
        if len(entradas) > config.max_lote:
            raise HTTPException(413, f"Lote grande demais (máximo {config.max_lote} detecções).")
        resultado = registrar_deteccoes(RepositorioObstaculos(sessao), entradas, config.raio_fusao_m)
        sessao.commit()
        return RespostaDeteccoes(
            recebidas=len(entradas),
            novas=resultado.novas,
            duplicadas=resultado.duplicadas,
            obstaculos=[ObstaculoSaida.model_validate(o) for o in resultado.afetados.values()],
        )

    @app.get("/obstaculos", response_model=list[ObstaculoSaida])
    def listar_obstaculos(
        sessao: SessaoDep,
        bbox: Annotated[str, Query(description="minLng,minLat,maxLng,maxLat (toBBoxString do Leaflet)")],
        classe: str | None = None,
        min_confirmacoes: Annotated[int, Query(ge=1)] = 1,
    ):
        try:
            min_lng, min_lat, max_lng, max_lat = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(422, "bbox deve ser 'minLng,minLat,maxLng,maxLat'.")
        if min_lng > max_lng or min_lat > max_lat:
            raise HTTPException(422, "bbox com mínimo maior que máximo.")
        repo = RepositorioObstaculos(sessao)
        return repo.listar_na_bbox(
            min_lng, min_lat, max_lng, max_lat,
            classe=classe.strip().lower() if classe else None,
            min_confirmacoes=min_confirmacoes,
        )

    @app.api_route("/mapa", methods=["GET", "HEAD"], include_in_schema=False)
    def mapa():
        return FileResponse(PASTA_STATIC / "mapa.html", media_type="text/html")

    # O mount estático fica por ÚLTIMO, para não engolir as rotas acima
    if config.web_dist.is_dir() and (config.web_dist / "index.html").is_file():
        app.mount("/", ArquivosSPA(directory=config.web_dist, html=True), name="web")
    else:
        @app.get("/", include_in_schema=False)
        def inicio():
            return HTMLResponse(
                (PASTA_STATIC / "inicio.html").read_text(encoding="utf-8")
            )

    return app


app = criar_app()
