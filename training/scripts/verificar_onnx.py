"""
Valida o ONNX exportado com o onnxruntime (CPU) usando o MESMO pré e
pós-processamento que o app web implementa em TypeScript:
letterbox 320 → inferência → decodificação → NMS.

Serve para três coisas:
1. garantir que o modelo exportado funciona fora do PyTorch;
2. ser a referência numérica do port para TS (web/src/core/posprocessamento.ts);
3. medir o tempo por frame no PC (só referência: o celular é bem mais lento).

Uso:
    python scripts/verificar_onnx.py --modelo exportados/buraco.onnx --imagem foto.jpg
    python scripts/verificar_onnx.py --modelo exportados/buraco.onnx --bench 50
"""

from __future__ import annotations

import argparse
import sys
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


def letterbox(img: Image.Image, tamanho: int):
    """Redimensiona mantendo proporção e completa com cinza 114 (igual ao Ultralytics)."""
    w, h = img.size
    escala = min(tamanho / w, tamanho / h)
    nw, nh = round(w * escala), round(h * escala)
    pad_x, pad_y = (tamanho - nw) // 2, (tamanho - nh) // 2
    tela = Image.new("RGB", (tamanho, tamanho), (114, 114, 114))
    tela.paste(img.convert("RGB").resize((nw, nh), Image.BILINEAR), (pad_x, pad_y))
    tensor = np.asarray(tela, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    return tensor, escala, pad_x, pad_y


def iou(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    x1 = np.maximum(a[0], b[:, 0]); y1 = np.maximum(a[1], b[:, 1])
    x2 = np.minimum(a[2], b[:, 2]); y2 = np.minimum(a[3], b[:, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    return inter / (area_a + area_b - inter + 1e-9)


def decodificar(saida: np.ndarray, conf_min: float, iou_nms: float):
    """saida: [1, 4+nc, N] → lista de (x1, y1, x2, y2, score, classe) em pixels do input."""
    pred = saida[0].T                      # [N, 4+nc]
    scores_cls = pred[:, 4:]
    classe = scores_cls.argmax(1)
    score = scores_cls.max(1)
    manter = score >= conf_min
    pred, classe, score = pred[manter], classe[manter], score[manter]
    cx, cy, w, h = pred[:, 0], pred[:, 1], pred[:, 2], pred[:, 3]
    caixas = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 1)

    resultado = []
    for c in np.unique(classe):            # NMS por classe
        idx = np.where(classe == c)[0]
        idx = idx[np.argsort(-score[idx])]
        while len(idx):
            i = idx[0]
            resultado.append((*caixas[i], float(score[i]), int(c)))
            if len(idx) == 1:
                break
            idx = idx[1:][iou(caixas[i], caixas[idx[1:]]) < iou_nms]
    return sorted(resultado, key=lambda r: -r[4])


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--modelo", required=True)
    p.add_argument("--imagem", help="imagem de teste; sem ela usa ruído (só para benchmark)")
    p.add_argument("--conf", type=float, default=0.35)
    p.add_argument("--iou", type=float, default=0.45)
    p.add_argument("--bench", type=int, default=0, help="nº de execuções para medir tempo")
    p.add_argument("--threads", type=int, default=1, help="threads de CPU (1 ≈ WASM sem SharedArrayBuffer)")
    a = p.parse_args()

    modelo = Path(a.modelo)
    rotulos_path = modelo.with_suffix(".labels.json")
    rotulos = json.loads(rotulos_path.read_text(encoding="utf-8")) if rotulos_path.exists() else None
    classes = rotulos["classes"] if rotulos else None
    imgsz = rotulos["imgsz"] if rotulos else 320

    opcoes = ort.SessionOptions()
    opcoes.intra_op_num_threads = a.threads
    sessao = ort.InferenceSession(str(modelo), opcoes, providers=["CPUExecutionProvider"])
    nome_entrada = sessao.get_inputs()[0].name

    if a.imagem:
        img = Image.open(a.imagem)
    else:
        img = Image.fromarray(np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8))
    tensor, escala, pad_x, pad_y = letterbox(img, imgsz)

    saida = sessao.run(None, {nome_entrada: tensor})[0]
    print(f"Forma da saída: {saida.shape}")
    deteccoes = decodificar(saida, a.conf, a.iou)
    print(f"{len(deteccoes)} detecção(ões) com conf ≥ {a.conf}:")
    for x1, y1, x2, y2, s, c in deteccoes[:20]:
        # volta para coordenadas da imagem original
        ox1, oy1 = (x1 - pad_x) / escala, (y1 - pad_y) / escala
        ox2, oy2 = (x2 - pad_x) / escala, (y2 - pad_y) / escala
        nome = classes[c] if classes else c
        print(f"  {nome:>14s} {s:.2f}  [{ox1:.0f}, {oy1:.0f}, {ox2:.0f}, {oy2:.0f}]")

    if a.bench:
        for _ in range(3):  # aquecimento
            sessao.run(None, {nome_entrada: tensor})
        tempos = []
        for _ in range(a.bench):
            t0 = time.perf_counter()
            sessao.run(None, {nome_entrada: tensor})
            tempos.append((time.perf_counter() - t0) * 1000)
        tempos = np.array(tempos)
        print(f"\nInferência ({a.threads} thread(s), {a.bench} execuções): "
              f"média {tempos.mean():.1f} ms | p50 {np.median(tempos):.1f} ms | p95 {np.percentile(tempos, 95):.1f} ms")
        print("Obs.: o celular costuma ser bem mais lento que o PC; o número que vale é o da página ?bench do app.")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # console do Windows usa cp1252
    main()
