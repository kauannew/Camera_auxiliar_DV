# Desempenho medido

Preencher com os números da página `?bench` do app, rodando no celular pelo túnel HTTPS.

| Data | Aparelho | Navegador | Backend ORT | Modelo | ms/frame (média) | p95 | FPS efetivo | Obs. |
|---|---|---|---|---|---|---|---|---|
| 2026-10-16 | PC (referência, onnxruntime CPU 1 thread) | — | CPU | provisorio_coco (yolo11n 320) | 22,6 | 24,2 | — | só referência |
| | Android intermediário | Chrome | WebGPU | buraco (yolo11n 320) | | | | |
| | Android intermediário | Chrome | WASM | buraco (yolo11n 320) | | | | |

**Meta:** inferência ≤ 200 ms (WASM) para manter 3 a 5 FPS com folga. Se não bater, as opções são, em ordem: imgsz 256, quantização INT8 e WASM multithread (requer COOP/COEP).
