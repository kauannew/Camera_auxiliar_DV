"""
Exporta pesos .pt do YOLO para ONNX pronto para o ONNX Runtime Web
e gera o labels.json lido pelo app.

Escolhas de export (ver docs/decisoes.md):
- imgsz 320 fixo (dynamic=False): menor custo por frame e grafo estático,
  o que o backend WebGPU do ORT Web prefere.
- opset 12: amplamente suportado pelos backends WASM e WebGPU.
- SEM NMS dentro do modelo: o NMS é feito em TypeScript (web/src/core),
  o que evita operadores pouco suportados no navegador.
- FP32: FP16 só ajuda no WebGPU e quebra no WASM; manter um único arquivo.

Saída do modelo: tensor [1, 4 + nc, N] (N = 2100 em 320×320),
  linhas 0..3 = cx, cy, w, h em PIXELS do input (0..320),
  linhas 4.. = pontuação por classe (já com sigmoid).

Uso:
    python scripts/exportar_onnx.py --pesos runs/buraco_yolo11n_320/weights/best.pt
    python scripts/exportar_onnx.py --pesos yolo11n.pt --nome provisorio_coco   # modelo de teste
"""

from __future__ import annotations

import argparse
import sys
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import onnx
from ultralytics import YOLO

RAIZ_TRAINING = Path(__file__).resolve().parent.parent
DESTINO_WEB = RAIZ_TRAINING.parent / "web" / "public" / "modelos"

# Tradução das classes do COCO usadas no modelo provisório (para a voz em pt-BR)
COCO_PT = {
    "person": "pessoa", "bicycle": "bicicleta", "car": "carro", "motorcycle": "moto",
    "bus": "ônibus", "truck": "caminhão", "traffic light": "semáforo",
    "fire hydrant": "hidrante", "stop sign": "placa de pare", "bench": "banco",
    "dog": "cachorro", "chair": "cadeira", "potted plant": "vaso de planta",
    "bottle": "garrafa", "cup": "copo", "backpack": "mochila", "umbrella": "guarda-chuva",
    "suitcase": "mala", "cell phone": "celular", "book": "livro",
}


def exportar(pesos: str, nome: str, imgsz: int, opset: int, copiar_para_web: bool) -> Path:
    modelo = YOLO(pesos)
    caminho_onnx = Path(modelo.export(
        format="onnx", imgsz=imgsz, opset=opset, simplify=True,
        dynamic=False, nms=False, half=False,
    ))

    # Confere o grafo e lê o formato real da saída
    grafo = onnx.load(str(caminho_onnx))
    onnx.checker.check_model(grafo)
    saida = grafo.graph.output[0]
    forma_saida = [d.dim_value for d in saida.type.tensor_type.shape.dim]
    entrada = grafo.graph.input[0]
    forma_entrada = [d.dim_value for d in entrada.type.tensor_type.shape.dim]

    nomes = modelo.names  # {0: 'buraco', ...}
    classes = [nomes[i] for i in sorted(nomes)]
    rotulos = {
        "modelo": f"{nome}.onnx",
        "arquitetura": Path(pesos).stem,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "imgsz": imgsz,
        "entrada": {"nome": entrada.name, "forma": forma_entrada, "formato": "RGB float32 0..1, NCHW, letterbox cinza 114"},
        "saida": {"nome": saida.name, "forma": forma_saida, "formato": "[1, 4+nc, N]: cx,cy,w,h em pixels + score por classe"},
        "classes": classes,
        # Nome falado de cada classe (o app usa isto na voz)
        "nomes_falados": [COCO_PT.get(c, c.replace("_", " ")) for c in classes],
    }

    pasta_saida = RAIZ_TRAINING / "exportados"
    pasta_saida.mkdir(exist_ok=True)
    destino_onnx = pasta_saida / f"{nome}.onnx"
    shutil.copy2(caminho_onnx, destino_onnx)
    destino_json = pasta_saida / f"{nome}.labels.json"
    destino_json.write_text(json.dumps(rotulos, ensure_ascii=False, indent=2), encoding="utf-8")

    tamanho_mb = destino_onnx.stat().st_size / 1e6
    print(f"\nONNX   : {destino_onnx} ({tamanho_mb:.1f} MB)")
    print(f"Labels : {destino_json}")
    print(f"Entrada: {entrada.name} {forma_entrada} | Saída: {saida.name} {forma_saida}")
    print(f"Classes: {len(classes)} → {classes[:5]}{' ...' if len(classes) > 5 else ''}")

    if copiar_para_web:
        DESTINO_WEB.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destino_onnx, DESTINO_WEB / destino_onnx.name)
        shutil.copy2(destino_json, DESTINO_WEB / destino_json.name)
        print(f"Copiado para o app web: {DESTINO_WEB}")
    return destino_onnx


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # console do Windows usa cp1252
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--pesos", required=True, help="caminho do .pt (ex.: runs/.../best.pt ou yolo11n.pt)")
    p.add_argument("--nome", default="buraco", help="nome base dos arquivos gerados")
    p.add_argument("--imgsz", type=int, default=320)
    p.add_argument("--opset", type=int, default=12)
    p.add_argument("--sem-copiar", action="store_true", help="não copiar para web/public/modelos")
    a = p.parse_args()
    exportar(a.pesos, a.nome, a.imgsz, a.opset, copiar_para_web=not a.sem_copiar)
