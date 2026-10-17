"""
Fine-tuning do YOLO nano no dataset combinado (gerado por preparar_dataset.py).

Parte dos pesos pré-treinados no COCO (aprendem bordas/texturas genéricas),
mas a cabeça é recriada só com as NOSSAS classes. Isso é intencional:
um único modelo pequeno = uma única inferência por frame no navegador.

Uso:
    python scripts/treinar.py --data datasets/calcada/data.yaml --epochs 80
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ultralytics import YOLO

RAIZ_TRAINING = Path(__file__).resolve().parent.parent


def treinar(args: argparse.Namespace) -> Path:
    modelo = YOLO(args.modelo)
    modelo.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,          # treina já na resolução de uso (320) → sem perda na troca
        batch=args.batch,
        patience=args.patience,    # para cedo se o mAP de validação estagnar
        device=args.device,
        project=str(RAIZ_TRAINING / "runs"),
        name=args.nome,
        exist_ok=True,
        seed=42,
        # Aumentos de dados pensados para câmera no peito andando na rua:
        # - fliplr: buraco não tem lado; flipud não (o chão sempre fica embaixo)
        # - hsv/escala: sol forte, sombra de árvore, piso molhado
        fliplr=0.5,
        flipud=0.0,
        degrees=5.0,               # leve balanço do corpo ao andar
        scale=0.5,
        hsv_v=0.5,
        mosaic=1.0,
        close_mosaic=10,
        plots=True,
    )
    melhor = RAIZ_TRAINING / "runs" / args.nome / "weights" / "best.pt"
    print(f"\nMelhores pesos: {melhor}")

    # Avaliação no split de teste (dados nunca vistos no treino nem na seleção do modelo)
    metricas = YOLO(melhor).val(
        data=args.data, imgsz=args.imgsz, split="test", plots=True,
        project=str(RAIZ_TRAINING / "runs"), name=f"{args.nome}_teste", exist_ok=True,
    )
    print("\nMétricas no TESTE:")
    print(f"  mAP50     : {metricas.box.map50:.3f}")
    print(f"  mAP50-95  : {metricas.box.map:.3f}")
    print(f"  precisão  : {metricas.box.mp:.3f}")
    print(f"  recall    : {metricas.box.mr:.3f}")
    return melhor


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # console do Windows usa cp1252
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", default=str(RAIZ_TRAINING / "datasets" / "calcada" / "data.yaml"))
    p.add_argument("--modelo", default="yolo11n.pt", help="yolo11n.pt (padrão) ou yolov8n.pt")
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--imgsz", type=int, default=320)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--patience", type=int, default=20)
    p.add_argument("--device", default=None, help="0 para GPU, 'cpu' para CPU; padrão: automático")
    p.add_argument("--nome", default="buraco_yolo11n_320")
    treinar(p.parse_args())
