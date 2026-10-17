# Arquitetura

```
┌──────────────────────── celular (Chrome, PWA) ─────────────────────────┐
│                                                                        │
│  câmera ──ImageBitmap──▶ Web Worker (ONNX Runtime Web: WebGPU → WASM)   │
│  (getUserMedia)            letterbox 320 → YOLO11n → decodificação+NMS  │
│        ▲                                   │ detecções (0..1)           │
│        │ 3–5 FPS, com contrapressão        ▼                            │
│  ┌─────┴──────────── núcleo TS puro (src/core) ────────────────────┐   │
│  │ heurística (zona, corredor, distância) → rastreador (N quadros) │   │
│  │ → priorizador (1 alerta, cooldown) → vibração + voz pt-BR       │   │
│  │ → registro (GPS) → fila offline (IndexedDB) ─────────────┐      │   │
│  │ vigia: avisa se a detecção travar                        │      │   │
│  └──────────────────────────────────────────────────────────┼──────┘   │
└─────────────────────────────────────────────────────────────┼──────────┘
                                                POST /deteccoes (lote, id idempotente)
┌──────────────────────── backend FastAPI ───────────────────▼──────────┐
│  deduplicação: mesma classe a ≤ 5 m → mesmo "ponto de obstáculo"       │
│  SQLite (MVP) · repositório isolado → PostGIS (ST_DWithin)             │
│  GET /obstaculos?bbox · GET /mapa (Leaflet + OSM) · serve o PWA em /   │
└────────────────────────────────────────────────────────────────────────┘
```

## Componentes

| Pasta | Papel | Detalhes |
|---|---|---|
| `training/` | Fine-tuning do YOLO11n e export para ONNX | `training/README.md` |
| `web/` | PWA: câmera, inferência, heurística, alertas, fila | `web/README.md` |
| `backend/` | API, deduplicação, mapa, hospedagem do PWA | `backend/README.md` |
| `docs/` | Decisões, calibração, limitações, licenças, demo | este diretório |

## Preparado para a migração ao nativo
- `web/src/core/` não usa nenhuma API do navegador: só as interfaces de `portas.ts`. Pode ser portado quase linha a linha para Kotlin/Swift/Dart, ou reaproveitado direto em React Native.
- No nativo, reimplementar só as portas: CameraX/AVFoundation (`Camera`), TFLite/ONNX Runtime Mobile (`Detector`), `Vibrator`/Core Haptics (`Haptico`), TextToSpeech (`Voz`), FusedLocation (`Localizacao`), Room/SQLite (`ArmazenamentoFila`).
- O mesmo `.onnx` roda no ONNX Runtime Mobile. Para TFLite, a Ultralytics exporta direto (`format="tflite"`).
- O contrato com o backend (`POST /deteccoes`) não muda.

## Decisões e limitações
- `docs/decisoes.md`: por que um modelo só, por que heurística, por que PWA primeiro.
- `docs/limitacoes.md`: HTTPS, iOS, segundo plano, GPS.
- `docs/licencas.md`: **AGPL da Ultralytics**.
