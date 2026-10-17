import uuid

from app.geo import METROS_POR_GRAU_LAT, haversine_m

# Ponto de referência: Av. Conde da Boa Vista, Recife
LAT, LNG = -8.0600, -34.8883


def deteccao(lat=LAT, lng=LNG, classe="buraco", confianca=0.8, id=None, timestamp="2026-10-16T12:00:00Z"):
    return {
        "id": id or str(uuid.uuid4()),
        "classe": classe,
        "lat": lat,
        "lng": lng,
        "precisao_gps": 4.5,
        "confianca": confianca,
        "timestamp": timestamp,
    }


def ao_norte(metros):
    """Latitude deslocada `metros` para o norte."""
    return LAT + metros / METROS_POR_GRAU_LAT


def listar(cliente, **params):
    params.setdefault("bbox", "-35,-8.1,-34.8,-8.0")
    resp = cliente.get("/obstaculos", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_saude(cliente):
    resp = cliente.get("/saude")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_funde_dentro_de_5m(cliente):
    r1 = cliente.post("/deteccoes", json=deteccao(confianca=0.6, timestamp="2026-10-16T12:00:00Z"))
    assert r1.status_code == 200, r1.text
    lat2 = ao_norte(3)
    assert haversine_m(LAT, LNG, lat2, LNG) < 5
    r2 = cliente.post("/deteccoes", json=deteccao(lat=lat2, confianca=1.0, timestamp="2026-10-16T12:05:00Z"))
    obst = r2.json()["obstaculos"]

    assert len(obst) == 1
    assert obst[0]["id"] == r1.json()["obstaculos"][0]["id"]
    assert obst[0]["confirmacoes"] == 2
    assert abs(obst[0]["confianca_media"] - 0.8) < 1e-9
    assert abs(obst[0]["lat"] - (LAT + lat2) / 2) < 1e-9  # média da posição
    assert obst[0]["primeira_vez"] == "2026-10-16T12:00:00Z"
    assert obst[0]["ultima_vez"] == "2026-10-16T12:05:00Z"
    assert len(listar(cliente)) == 1


def test_ponto_a_10m_vira_outro_obstaculo(cliente):
    cliente.post("/deteccoes", json=deteccao())
    r = cliente.post("/deteccoes", json=deteccao(lat=ao_norte(10)))
    assert r.json()["obstaculos"][0]["confirmacoes"] == 1
    assert len(listar(cliente)) == 2


def test_classes_diferentes_nao_fundem(cliente):
    cliente.post("/deteccoes", json=deteccao(classe="buraco"))
    cliente.post("/deteccoes", json=deteccao(lat=ao_norte(1), classe="poste"))
    pontos = listar(cliente)
    assert sorted(p["classe"] for p in pontos) == ["buraco", "poste"]
    assert all(p["confirmacoes"] == 1 for p in pontos)
    assert [p["classe"] for p in listar(cliente, classe="poste")] == ["poste"]


def test_escolhe_o_mais_proximo(cliente):
    # dois obstáculos a 8 m um do outro; detecção no meio, mais perto do segundo
    cliente.post("/deteccoes", json=deteccao())
    r = cliente.post("/deteccoes", json=deteccao(lat=ao_norte(8)))
    id_segundo = r.json()["obstaculos"][0]["id"]
    r = cliente.post("/deteccoes", json=deteccao(lat=ao_norte(5)))
    assert r.json()["obstaculos"][0]["id"] == id_segundo


def test_idempotencia_por_id(cliente):
    d = deteccao()
    r1 = cliente.post("/deteccoes", json=d)
    r2 = cliente.post("/deteccoes", json=d)
    assert r1.json()["novas"] == 1
    assert r2.json()["novas"] == 0
    assert r2.json()["duplicadas"] == 1
    pontos = listar(cliente)
    assert len(pontos) == 1
    assert pontos[0]["confirmacoes"] == 1


def test_lote(cliente):
    repetida = deteccao(lat=ao_norte(2))
    lote = [deteccao(), repetida, repetida, deteccao(lat=ao_norte(50)), deteccao(classe="poste")]
    r = cliente.post("/deteccoes", json=lote)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert (corpo["recebidas"], corpo["novas"], corpo["duplicadas"]) == (5, 4, 1)
    assert len(corpo["obstaculos"]) == 3
    confirmacoes = sorted(p["confirmacoes"] for p in listar(cliente))
    assert confirmacoes == [1, 1, 2]

    # reenvio do lote inteiro (fila offline) não muda nada
    r = cliente.post("/deteccoes", json=lote)
    assert r.json()["novas"] == 0
    assert sorted(p["confirmacoes"] for p in listar(cliente)) == [1, 1, 2]


def test_filtro_por_bbox(cliente):
    cliente.post("/deteccoes", json=deteccao())  # Boa Vista
    cliente.post("/deteccoes", json=deteccao(lat=-8.0631, lng=-34.8711))  # Recife Antigo
    cliente.post("/deteccoes", json=deteccao(lat=-23.55, lng=-46.63))  # São Paulo

    # bbox só em volta da Boa Vista (minLng,minLat,maxLng,maxLat)
    pontos = listar(cliente, bbox="-34.890,-8.061,-34.887,-8.059")
    assert len(pontos) == 1
    assert abs(pontos[0]["lng"] - LNG) < 1e-9

    assert len(listar(cliente, bbox="-35,-8.1,-34.8,-8.0")) == 2
    assert len(listar(cliente, bbox="-50,-30,-30,0")) == 3


def test_filtro_min_confirmacoes(cliente):
    cliente.post("/deteccoes", json=[deteccao(), deteccao(lat=ao_norte(1))])
    cliente.post("/deteccoes", json=deteccao(lat=ao_norte(100)))
    assert len(listar(cliente, min_confirmacoes=2)) == 1


def test_validacao(cliente):
    assert cliente.post("/deteccoes", json=deteccao(confianca=1.5)).status_code == 422
    assert cliente.post("/deteccoes", json=deteccao(confianca=-0.1)).status_code == 422
    assert cliente.post("/deteccoes", json=deteccao(lat=91)).status_code == 422
    assert cliente.post("/deteccoes", json=deteccao(lng=-181)).status_code == 422
    assert cliente.post("/deteccoes", json={**deteccao(), "id": "nao-e-uuid"}).status_code == 422
    assert cliente.get("/obstaculos", params={"bbox": "1,2,3"}).status_code == 422
    assert cliente.get("/obstaculos", params={"bbox": "3,2,1,4"}).status_code == 422
    assert listar(cliente) == []


def test_mapa_sem_isolamento(cliente):
    resp = cliente.get("/mapa")
    assert resp.status_code == 200
    assert "leaflet@1.9.4" in resp.text
    assert "Cross-Origin-Embedder-Policy" not in resp.headers
    assert "Cross-Origin-Embedder-Policy" not in cliente.get("/obstaculos", params={"bbox": "0,0,1,1"}).headers


def test_raiz_sem_web_dist(cliente):
    resp = cliente.get("/")
    assert resp.status_code == 200
    assert 'href="/mapa"' in resp.text


def test_serve_web_dist_com_coop_coep(cliente_com_web):
    c = cliente_com_web
    raiz = c.get("/")
    assert "PWA" in raiz.text
    assert raiz.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert raiz.headers["Cross-Origin-Embedder-Policy"] == "require-corp"

    assert "PWA" in c.get("/alguma/rota/do/app").text  # fallback do SPA
    assert c.get("/assets/ort.wasm").headers["content-type"] == "application/wasm"
    assert c.get("/modelo.onnx").headers["content-type"] == "application/octet-stream"
    assert c.get("/nao_existe.onnx").status_code == 404

    # as rotas da API continuam funcionando com o mount em "/"
    assert c.get("/saude").json()["status"] == "ok"
    assert "Cross-Origin-Embedder-Policy" not in c.get("/mapa").headers
