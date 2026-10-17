# Backend – Câmera Auxiliar DV

API em FastAPI que recebe as detecções de buracos enviadas pelo celular, funde as que estão no mesmo lugar e alimenta o mapa colaborativo de pontos problemáticos. Também hospeda o PWA (`web/dist`).

- **Stack:** Python 3.11+, FastAPI, SQLAlchemy 2, SQLite (MVP).
- **Migração para PostGIS:** toda consulta espacial fica em [`app/repositorio.py`](app/repositorio.py). O arquivo traz em comentário o SQL equivalente com `ST_DWithin`.

## Instalar

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Linux/macOS:  source .venv/bin/activate
pip install -r requirements.txt
```

## Rodar

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Mapa: <http://localhost:8000/mapa>
- Documentação interativa da API: <http://localhost:8000/docs>
- PWA: <http://localhost:8000/>. Se `web/dist` não existir, a raiz mostra uma página com link para o mapa.

### Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/camera_dv.db` | Conexão do banco |
| `RAIO_FUSAO_M` | `5` | Distância (m) para considerar duas detecções o mesmo obstáculo |
| `WEB_DIST` | `../web/dist` | Pasta do build do PWA |

## Popular com dados de exemplo (seed)

28 buracos em Recife: Boa Vista, Recife Antigo, Av. Conde da Boa Vista, Rua da Aurora e Derby. Cada um tem de 1 a 12 confirmações e datas recentes.

```bash
python -m app.seed           # idempotente: rodar de novo não duplica
python -m app.seed --reset   # apaga tudo (inclusive detecções reais) e reinsere
```

## Testes

```bash
python -m pytest
```

Os testes cobrem: fusão dentro de 5 m, ponto separado a 10 m, classes diferentes que não se fundem, idempotência por id, envio em lote, filtros por bbox, classe e confirmações, validação, e os cabeçalhos COOP/COEP e os MIME no PWA.

## Testar no celular (HTTPS com cloudflared)

Câmera, GPS e vibração exigem HTTPS no celular. O jeito mais rápido é um túnel temporário:

```bash
cloudflared tunnel --url http://localhost:8000
```

O comando mostra uma URL `https://<algo>.trycloudflare.com`. Abra essa URL no celular. Instalação: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/> (no Windows: `winget install --id Cloudflare.cloudflared`).

## API

### `POST /deteccoes`

Aceita **uma detecção** ou uma **lista** (reenvio da fila offline, até 500 itens). O `id` é um uuid gerado no celular. Se o mesmo `id` chegar de novo, ele é ignorado (não duplica nem conta outra confirmação).

```bash
curl -X POST http://localhost:8000/deteccoes \
  -H "Content-Type: application/json" \
  -d '{"id":"0b8e4a52-3f0c-4f7e-9a51-6d2a1c9e7b10","classe":"buraco","lat":-8.0601,"lng":-34.8883,"precisao_gps":4.2,"confianca":0.87,"timestamp":"2026-10-16T14:30:00-03:00"}'
```

Lote:

```bash
curl -X POST http://localhost:8000/deteccoes \
  -H "Content-Type: application/json" \
  -d '[{"id":"5d7f8c1a-0000-4000-8000-000000000001","classe":"buraco","lat":-8.0631,"lng":-34.8711,"confianca":0.7,"timestamp":"2026-10-16T14:31:00Z"},
       {"id":"5d7f8c1a-0000-4000-8000-000000000002","classe":"buraco","lat":-8.06312,"lng":-34.87112,"confianca":0.9,"timestamp":"2026-10-16T14:31:05Z"}]'
```

Resposta (os obstáculos criados ou atualizados):

```json
{
  "recebidas": 2, "novas": 2, "duplicadas": 0,
  "obstaculos": [
    {"id": "…", "classe": "buraco", "lat": -8.06311, "lng": -34.87111, "confirmacoes": 2,
     "confianca_media": 0.8, "primeira_vez": "2026-10-16T14:31:00Z", "ultima_vez": "2026-10-16T14:31:05Z"}
  ]
}
```

Validação: `lat` ∈ [-90, 90], `lng` ∈ [-180, 180], `confianca` ∈ [0, 1], `precisao_gps` ≥ 0 (opcional). Se algum item for inválido, a resposta é `422`.

### `GET /obstaculos`

```bash
curl "http://localhost:8000/obstaculos?bbox=-34.91,-8.07,-34.86,-8.05"
curl "http://localhost:8000/obstaculos?bbox=-34.91,-8.07,-34.86,-8.05&classe=buraco&min_confirmacoes=5"
```

`bbox` = `minLng,minLat,maxLng,maxLat`, na mesma ordem do `map.getBounds().toBBoxString()` do Leaflet.

### `GET /saude`

```bash
curl http://localhost:8000/saude
```

## Como funciona a deduplicação

1. Se o `id` da detecção já existe, ela é ignorada.
2. O backend busca obstáculos da **mesma classe** dentro de uma caixa de ±`RAIO_FUSAO_M` em volta do ponto. A conversão para graus usa `lat: r/111320` e `lng: r/(111320·cos(lat))`.
3. Calcula a distância haversine e escolhe o mais próximo que esteja a até `RAIO_FUSAO_M`.
4. Se achou um: soma uma confirmação, atualiza `ultima_vez` e recalcula as médias de posição e de confiança. Se não achou: cria um obstáculo novo.

Toda detecção bruta fica guardada na tabela `deteccoes`, com o `obstaculo_id` do ponto em que foi fundida.

## COOP/COEP e o ONNX Runtime

O ONNX Runtime WASM com várias threads precisa de `SharedArrayBuffer`, e o navegador só libera isso quando a página tem estes cabeçalhos:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

O middleware coloca esses cabeçalhos no PWA (`/` e nos arquivos dele). Ele **não** coloca em `/mapa`, `/obstaculos`, `/deteccoes`, `/saude` nem `/docs`. O motivo: com `require-corp`, o navegador bloquearia o Leaflet do unpkg e os tiles do OpenStreetMap. Os arquivos `.wasm` saem como `application/wasm` e os `.onnx` como `application/octet-stream`.
