"""
Combina uma ou mais fontes (YOLO ou Pascal VOC) num único dataset YOLO
com as NOSSAS classes, definidas em config/dataset.yaml.

- Renomeia/remapeia classes (ex.: "pothole" → "buraco") e descarta as não mapeadas.
- Converte polígonos de segmentação em bbox.
- Mantém o split original da fonte (train/valid/test); se não houver, divide
  de forma determinística (por hash do nome do arquivo).
- Imagens que ficarem sem nenhum rótulo são mantidas como negativos (fundo).

Uso:
    python scripts/preparar_dataset.py --config config/dataset.yaml
"""

from __future__ import annotations

import argparse
import sys
import hashlib
import shutil
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

import yaml

RAIZ_TRAINING = Path(__file__).resolve().parent.parent
EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Nomes de pasta de split usados por Roboflow/Kaggle → nosso nome
ALIASES_SPLIT = {"train": "train", "valid": "val", "val": "val", "test": "test"}


def carregar_config(caminho: Path) -> dict:
    with open(caminho, encoding="utf-8") as f:
        return yaml.safe_load(f)


def split_por_hash(nome: str, frac_val: float, frac_test: float) -> str:
    """Divide de forma estável: o mesmo arquivo sempre cai no mesmo split."""
    h = int(hashlib.md5(nome.encode()).hexdigest(), 16) % 10_000 / 10_000
    if h < frac_test:
        return "test"
    if h < frac_test + frac_val:
        return "val"
    return "train"


def linha_para_bbox(partes: list[str]) -> tuple[int, float, float, float, float] | None:
    """Aceita linha YOLO de detecção (5 valores) ou de segmentação (classe + polígono)."""
    if len(partes) < 5:
        return None
    cls = int(float(partes[0]))
    valores = [float(v) for v in partes[1:]]
    if len(valores) == 4:
        cx, cy, w, h = valores
    else:
        xs, ys = valores[0::2], valores[1::2]
        x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
        cx, cy, w, h = (x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1
    if w <= 0 or h <= 0:
        return None
    return cls, cx, cy, w, h


def ler_nomes_yolo(pasta: Path) -> list[str]:
    data_yaml = pasta / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(f"{data_yaml} não encontrado (export YOLO deve trazer data.yaml)")
    dados = carregar_config(data_yaml)
    nomes = dados["names"]
    if isinstance(nomes, dict):  # formato {0: 'pothole', ...}
        nomes = [nomes[k] for k in sorted(nomes)]
    return [str(n) for n in nomes]


def coletar_yolo(pasta: Path):
    """Gera (imagem, split_ou_None, [(nome_classe, cx, cy, w, h), ...])."""
    nomes = ler_nomes_yolo(pasta)
    imagens = [p for p in pasta.rglob("*") if p.suffix.lower() in EXTENSOES_IMAGEM]
    for img in imagens:
        # .../<split>/images/x.jpg  ou  .../images/<split>/x.jpg
        partes = [p.lower() for p in img.relative_to(pasta).parts]
        split = next((ALIASES_SPLIT[p] for p in partes if p in ALIASES_SPLIT), None)
        # Caminho padrão: troca o diretório "images" por "labels"
        rotulo = None
        rel = list(img.relative_to(pasta).parts)
        if "images" in rel:
            rel[rel.index("images")] = "labels"
            rotulo = (pasta / Path(*rel)).with_suffix(".txt")
        caixas = []
        if rotulo is not None and rotulo.exists():
            for linha in rotulo.read_text(encoding="utf-8").splitlines():
                bbox = linha_para_bbox(linha.split())
                if bbox is None:
                    continue
                cls, cx, cy, w, h = bbox
                if 0 <= cls < len(nomes):
                    caixas.append((nomes[cls], cx, cy, w, h))
        yield img, split, caixas


def coletar_voc(pasta: Path):
    """Pascal VOC: um .xml por imagem, com <size> e <object><bndbox>."""
    for xml_path in pasta.rglob("*.xml"):
        raiz = ET.parse(xml_path).getroot()
        nome_img = raiz.findtext("filename") or xml_path.with_suffix(".jpg").name
        candidatos = list(pasta.rglob(nome_img)) or [
            p for p in pasta.rglob(xml_path.stem + ".*") if p.suffix.lower() in EXTENSOES_IMAGEM
        ]
        if not candidatos:
            continue
        img = candidatos[0]
        largura = float(raiz.findtext("size/width") or 0)
        altura = float(raiz.findtext("size/height") or 0)
        if largura <= 0 or altura <= 0:
            continue
        caixas = []
        for obj in raiz.findall("object"):
            b = obj.find("bndbox")
            x1, y1 = float(b.findtext("xmin")), float(b.findtext("ymin"))
            x2, y2 = float(b.findtext("xmax")), float(b.findtext("ymax"))
            caixas.append((
                obj.findtext("name") or "",
                (x1 + x2) / 2 / largura, (y1 + y2) / 2 / altura,
                (x2 - x1) / largura, (y2 - y1) / altura,
            ))
        partes = [p.lower() for p in img.relative_to(pasta).parts]
        split = next((ALIASES_SPLIT[p] for p in partes if p in ALIASES_SPLIT), None)
        yield img, split, caixas


def preparar(config_path: Path) -> Path:
    cfg = carregar_config(config_path)
    classes: list[str] = cfg["classes"]
    indice = {c: i for i, c in enumerate(classes)}
    saida = (RAIZ_TRAINING / cfg["saida"]).resolve()
    frac_val = cfg.get("divisao_padrao", {}).get("val", 0.1)
    frac_test = cfg.get("divisao_padrao", {}).get("test", 0.1)

    if saida.exists():
        shutil.rmtree(saida)
    for split in ("train", "val", "test"):
        (saida / "images" / split).mkdir(parents=True)
        (saida / "labels" / split).mkdir(parents=True)

    estatisticas = Counter()
    for fonte in cfg["fontes"]:
        pasta = (RAIZ_TRAINING / fonte["caminho"]).resolve()
        if not pasta.exists():
            print(f"[aviso] fonte '{fonte['nome']}' não encontrada em {pasta}; pulando")
            continue
        mapa = {k.lower(): v for k, v in fonte["mapa_classes"].items()}
        coletor = coletar_yolo if fonte["formato"] == "yolo" else coletar_voc
        descartadas = Counter()

        for img, split, caixas in coletor(pasta):
            nome = f"{fonte['nome']}__{img.stem}"
            split = split or split_por_hash(nome, frac_val, frac_test)
            linhas = []
            for nome_cls, cx, cy, w, h in caixas:
                nossa = mapa.get(nome_cls.lower())
                if nossa is None or nossa not in indice:
                    descartadas[nome_cls] += 1
                    continue
                # Limita ao frame (alguns exports têm caixas levemente fora)
                cx, cy = min(max(cx, 0), 1), min(max(cy, 0), 1)
                w, h = min(w, 1), min(h, 1)
                linhas.append(f"{indice[nossa]} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                estatisticas[(split, nossa)] += 1
            shutil.copy2(img, saida / "images" / split / f"{nome}{img.suffix.lower()}")
            (saida / "labels" / split / f"{nome}.txt").write_text("\n".join(linhas), encoding="utf-8")
            estatisticas[(split, "_imagens")] += 1
            if not linhas:
                estatisticas[(split, "_negativos")] += 1

        if descartadas:
            print(f"[info] '{fonte['nome']}': classes descartadas (não mapeadas): {dict(descartadas)}")

    data_yaml = {
        "path": str(saida),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": {i: c for i, c in enumerate(classes)},
    }
    with open(saida / "data.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(data_yaml, f, allow_unicode=True, sort_keys=False)

    print("\nResumo do dataset combinado:")
    for split in ("train", "val", "test"):
        partes = [f"{estatisticas[(split, '_imagens')]} imagens",
                  f"{estatisticas[(split, '_negativos')]} sem rótulo"]
        partes += [f"{estatisticas[(split, c)]} × {c}" for c in classes]
        print(f"  {split:5s}: " + ", ".join(partes))
    print(f"\ndata.yaml → {saida / 'data.yaml'}")
    return saida / "data.yaml"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # console do Windows usa cp1252
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", default=str(RAIZ_TRAINING / "config" / "dataset.yaml"))
    args = parser.parse_args()
    preparar(Path(args.config))
