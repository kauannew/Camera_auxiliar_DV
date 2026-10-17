# Decisões de arquitetura

Registro curto das decisões, do porquê e do que faria mudá-las.

## D1. Inferência no dispositivo, nunca na nuvem
**Por quê:** um alerta de buraco que chega 1 s atrasado chega depois do buraco. A ida e volta pela rede 4G varia de centenas de ms a segundos e some quando o sinal cai. No aparelho, a latência é previsível e o app funciona sem internet. Só o registro no mapa depende de rede, e ele tem fila offline.

## D2. Um único modelo YOLO nano, só com as nossas classes
**Problema:** fine-tuning só com buracos faz o modelo "esquecer" as 80 classes do COCO.

**Alternativas avaliadas:**

| Opção | Custo por frame no navegador | Comentário |
|---|---|---|
| **A. Modelo único com as nossas classes** ✅ | 1 inferência | Simples. O modelo esquece o COCO, mas não precisamos dele. |
| B. Modelo único, dataset combinado (nossas classes + subconjunto do COCO) | 1 inferência | Mais trabalho de curadoria e treino mais longo. Vale se alguma classe do COCO for necessária. |
| C. Dois modelos em sequência (COCO + buracos) | 2 inferências | Dobra a latência e a memória. Inviável a 3–5 FPS no WASM. |

**Decisão:** A, com a estrutura pronta para B. `config/dataset.yaml` combina várias fontes com `mapa_classes`. `obstaculo_suspenso` entra como segunda classe do **mesmo** modelo.

**Por que não precisamos do COCO:** pessoas, carros e bicicletas a bengala, a audição e o próprio fluxo de pedestres já cobrem. O valor do app está no que a bengala percebe mal: buracos (antes de a ponta cair neles) e, na fase 2, obstáculos suspensos (acima da altura da bengala).

## D3. yolo11n em 320×320, exportado em ONNX opset 12, sem NMS e em FP32
- **yolo11n** em vez de yolov8n: menos FLOPs (~6,5 contra ~8,7 G) e mAP no COCO um pouco maior. O yolov8n continua como alternativa (`--modelo yolov8n.pt`).
- **320** em vez de 640: cerca de 4× menos computação. Buracos próximos (os que importam) ocupam boa parte do quadro. Os distantes se perdem, e não há problema nisso.
- **Sem NMS no grafo:** operadores de NMS têm suporte irregular no ORT Web/WebGPU. Em TypeScript é trivial e fica testável.
- **FP32:** FP16 só acelera no WebGPU e prejudica o WASM. Um arquivo só simplifica. A quantização INT8 fica para depois, se o WASM ficar lento demais.

## D4. Distância por heurística da bounding box (sem modelo de profundidade)
Com o celular fixo no peito e inclinado para o chão, a geometria é quase constante: quanto mais baixa a base da caixa no quadro, mais perto está o objeto no chão. A área relativa reforça a estimativa. É barato (custo zero por frame) e calibrável com trena. Modelos de profundidade monocular (Depth Anything) custariam mais uma inferência pesada por frame. Ficam no roadmap, no app nativo.

**Limitação:** a heurística assume chão plano e o objeto **no chão**. Ela não serve para obstáculos suspensos. Na fase 2, eles vão precisar de outra regra (por exemplo, área e posição no topo do quadro) ou de profundidade.

## D5. PWA antes do nativo, com núcleo em TypeScript puro
A PWA permite testar no celular em minutos, sem loja nem build nativo. A lógica de heurística, zonas, rastreamento, cooldown e fila fica em `web/src/core` **sem APIs do navegador**. As APIs de plataforma ficam atrás de interfaces em `web/src/plataforma`. Na migração, o núcleo pode ser portado quase 1:1 (ou reaproveitado em React Native) e só os adaptadores são reescritos.

## D6. Backend FastAPI + SQLite, pronto para PostGIS
SQLite basta para a demo. A consulta espacial fica isolada num repositório e troca para `ST_DWithin` no PostGIS sem mexer nas rotas. O FastAPI serve o app e o mapa na mesma origem: um só túnel HTTPS e nada de CORS.

## D7. Dataset: público + fotos próprias
O dataset público (Kaggle `andrewmvd/pothole-detection` por padrão, ou Roboflow Universe) garante a partida. Como ele é de rua vista do carro, as fotos próprias de calçadas, tiradas com o celular no peito, são o que fecha a diferença de domínio.
