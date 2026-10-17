# App web (`/web`)

PWA em TypeScript + Vite que detecta obstáculos pela câmera traseira, com o celular no peito, e alerta por **vibração e voz em pt-BR**. Detecções confirmadas vão com GPS para o backend (mapa colaborativo), com fila offline no IndexedDB.

## Rodar

Pré-requisitos: Node 20+ e o backend instalado (ver `backend/README.md`).

```bash
npm install
```

**Jeito recomendado (mesma origem, igual à demo):** gere o build e deixe o FastAPI servir o app.

```bash
npm run build
```
```bash
cd ../backend && .venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Abra <http://localhost:8000>. O mapa fica em <http://localhost:8000/mapa>.

**Desenvolvimento com recarga automática:** `npm run dev` sobe o Vite na porta 5173, com proxy de `/deteccoes`, `/obstaculos` e `/mapa` para o backend na porta 8000.

### Testar no celular (HTTPS obrigatório)

Câmera e GPS só funcionam em **HTTPS** (ou em `localhost`). O jeito mais simples é um túnel do cloudflared, que não pede conta:

```bash
cloudflared tunnel --url http://localhost:8000
```

Abra no Chrome do Android a URL `https://….trycloudflare.com` que aparecer. Para usar o servidor do Vite em vez do backend, aponte o túnel para `http://localhost:5173` (os domínios do túnel já estão liberados em `vite.config.ts`). Com o ngrok funciona igual: `ngrok http 8000`.

## Testes

```bash
npm test
```

Os testes do Vitest cobrem o núcleo: decodificação e NMS, heurística, rastreio e confirmação, cooldown e prioridade, fila offline, vigia e orquestrador com dublês.

## Parâmetros de URL

| Parâmetro | Efeito |
|---|---|
| `?debug=1` | abre no **modo calibração** (vídeo + caixas + zonas + métricas) |
| `?bench` | página de **medição de desempenho**; `&imagem=/foto.jpg` usa uma imagem fixa |
| `?backend=wasm` ou `webgpu` | força o backend do ONNX Runtime |
| `?modelo=buraco` | usa `/modelos/buraco.onnx` + `buraco.labels.json` |
| `?registrarTodas=1` | envia ao mapa qualquer classe (para testar o fluxo com o modelo provisório) |
| `?fps=5` | muda o teto de quadros por segundo |

## Arquitetura

```
src/core/          TypeScript PURO (sem DOM/APIs do navegador), pronto para o nativo
  config.ts          ← TODOS os limiares ajustáveis (zonas, distância, N quadros, cooldown, vibração)
  tipos.ts, portas.ts  tipos e interfaces de plataforma (Camera, Detector, Voz, Haptico, ...)
  posprocessamento.ts  decodificação YOLO + NMS + desfazer letterbox
  heuristica.ts      zona, corredor central, proximidade (base Y + área)
  rastreador.ts      associação entre quadros + confirmação em N quadros
  priorizador.ts     um alerta por vez, cooldown, realerta ao aproximar
  mensagens.ts       textos falados
  filaEnvio.ts       fila de envio resistente a falta de rede
  vigia.ts           avisa se a detecção travar (silêncio ≠ caminho livre)
  orquestrador.ts    liga tudo usando apenas as portas
src/plataforma/web/  adaptadores: getUserMedia, Worker+ORT, speechSynthesis,
                     Vibration (ou bipes WebAudio), Geolocation, Wake Lock, IndexedDB, fetch
src/worker/          inferência no Web Worker (WebGPU → WASM), letterbox via OffscreenCanvas
src/ui/              tela única acessível, sobreposição de calibração, benchmark
```

Fluxo por quadro: `createImageBitmap(video)` → transferido ao worker → letterbox 320 → ORT → decodificação + NMS → volta à thread principal → heurística → rastreio → priorizador → vibração e voz. Há **contrapressão**: o próximo quadro só é capturado depois que o anterior volta, com teto de `fpsAlvo` (padrão 4).

## Trocar para o modelo de buracos

1. Treine e exporte com `training/` (gera `buraco.onnx` + `buraco.labels.json`).
2. Copie os dois arquivos para `web/public/modelos/`.
3. Em `src/core/config.ts`, aponte `modelo.url` e `modelo.rotulos` para eles. Para testar antes de mudar a config, use `?modelo=buraco`.

## Desempenho medido

| Ambiente | Backend | Inferência (média) | Quadro completo |
|---|---|---|---|
| PC, Chrome 152 | WASM 4 threads | 49,8 ms | 59 ms |
| PC, Chrome 152 | WebGPU | 41,7 ms | 49 ms |

Números do celular: rode `?bench` no aparelho e registre em `docs/desempenho.md`.

## Limitações (detalhes em `docs/limitacoes.md`)

- **HTTPS obrigatório** para câmera e GPS. Use o túnel.
- **Safari/iOS não tem Vibration API**: o app toca bipes com o mesmo ritmo. O público da demo é Android + Chrome.
- **Só funciona com a tela ligada e a aba aberta.** O app mantém a tela ligada (Wake Lock), pausa sozinho ao ir para segundo plano e avisa por voz ao voltar.
- Primeira abertura: baixa o modelo (~10 MB) e o runtime (de ~3,7 a ~6,7 MB comprimidos). Depois fica no cache (service worker).
