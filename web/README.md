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

Os testes do Vitest cobrem o núcleo: decodificação e NMS, heurística, rastreio e confirmação, cooldown e prioridade, fila offline, vigia e orquestrador com dublês, além do serviço de rotas e formatadores.

## Aba Rotas

Rota acessível pela API `https://rotas.antonioqueiroz.dev` (GET `/api/rota?origem=lat,lon&destino=lat,lon`), desenhada num mapa Leaflet, com o trajeto lido em voz passo a passo. 

A interface conta com dois seletores acessíveis (Opção Estado/Cidade) e suporte a GPS em tempo real:
1. **Bahia (BA):** Salvador · Pelourinho → Portas do Carmo (com desvio de obstáculos ativo).
2. **Pernambuco (PE):** Recife · Conde da Boa Vista → Marco Zero.
3. **São Paulo (SP):** São Paulo · Av. Paulista → MASP.
4. **📍 Meu Local Atual (GPS):** Obtém a latitude e longitude do dispositivo via Geolocation API, calcula um destino acessível a ~400 metros e traça a rota na calçada real de onde o usuário estiver fisicamente.

| Variável (`.env.local`) | Efeito |
|---|---|
| `VITE_ROTAS_API` | troca a URL base da API de rotas |
| `VITE_MAPA_TILES` | URL de tiles do mapa (ex.: MapTiler/Stadia com chave). Sem ela, usa o OpenStreetMap, escurecido por CSS |

O servidor de tiles precisa responder com CORS (`Access-Control-Allow-Origin`), porque o app usa COEP `require-corp`. O CARTO `dark_all` passou a exigir chave de API e não serve mais para isso.

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
src/interface/       Nova interface React + Tailwind v4 (Sentinela Visual), mobile-first e de alto contraste
  useSentinela.ts    estado e ações da UI (telas, fase, config, alternância Real vs Simulador)
  cenarios.ts        contrato de alerta (`Cenario`) + simulador do pitch
  camera/            ponte com o Orquestrador (ponteOrquestrador.ts) e adaptadores de voz/háptico
  rotas/             apiRotas (GET /api/rota), useRota (hook cancelável e passo a passo), formatadores
  componentes/       Cabecalho, BarraStatus, CartaoRadar, Botao, BotaoAlternar, PainelConfig, BordaAlerta, BarraSimulador, MapaRota, NavegacaoAbas
  telas/             TelaInicio, TelaMonitor, TelaConfig, TelaRotas
src/index.css        tokens do tema (@theme), fonte Atkinson Hyperlegible, foco AAA, tema Leaflet
src/ui/              interface anterior (calibração, benchmark), acessível em /legacy.html
```

## Modos de Operação

Para garantir a usabilidade e permitir a homologação do sistema em ambientes controlados:

1. **Modo Demonstração (Simulador):** Executa um ciclo de alertas automatizado (`DEMO_AUTOMATICA` a cada 3,5s) ou acionado via teclado (`1`, `2`, `3`, `4`). Ideal para apresentar e testar o feedback multissensorial (voz e vibração) do aplicativo em ambientes fechados, sem depender de iluminação externa, movimentação na rua ou conexão com a câmera.
2. **Modo Câmera Real (IA YOLO11n ONNX):** Inicializa a câmera traseira do aparelho (`facingMode: environment`), roda o Web Worker com YOLO11n (WebGPU/WASM), analisa quadros com heurística de zonas e priorização real, e reporta métricas de inferência e FPS em tempo real.
3. **Alternância Dinâmica:** A transição entre os modos pode ser feita diretamente na `TelaInicio` ou no `PainelConfig`. Caso o hardware da câmera falhe ou a permissão seja negada pelo navegador, a UI oferece um *fallback* amigável de 1 clique para retornar ao modo simulado, garantindo a continuidade da experiência do usuário.

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
- **Safari/iOS não tem Vibration API**: o app toca bipes com o mesmo ritmo. A aplicação foi otimizada para o ecossistema Android + Chrome nesta versão inicial.
- **Só funciona com a tela ligada e a aba aberta.** O app mantém a tela ligada (Wake Lock), pausa sozinho ao ir para segundo plano e avisa por voz ao voltar.
- Primeira abertura: baixa o modelo (~10 MB) e o runtime (de ~3,7 a ~6,7 MB comprimidos). Depois fica no cache (service worker).
