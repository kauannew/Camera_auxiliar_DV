# Treino do detector (`/training`)

Fine-tuning do **YOLO nano (yolo11n)** para detectar buracos em calçadas, com export para **ONNX** rodando no navegador do celular (ONNX Runtime Web).

## Estrutura

```
config/dataset.yaml        classes do modelo + fontes de dados a combinar
scripts/preparar_dataset.py  combina fontes (YOLO/VOC/segmentação) nas nossas classes
scripts/treinar.py         fine-tuning em 320×320 + avaliação no teste
scripts/exportar_onnx.py   export ONNX (opset 12, sem NMS) + labels.json → web/public/modelos
scripts/verificar_onnx.py  roda o ONNX com o MESMO pós-processamento do app + benchmark
treino_buraco.ipynb        notebook do Colab que executa tudo acima
```

## Caminho rápido (Colab, GPU gratuita)

1. Suba o repositório no GitHub (ou compacte `training/` em `training.zip`).
2. Abra `treino_buraco.ipynb` no Colab: *Arquivo → Abrir notebook → GitHub*. Selecione **GPU T4** em *Ambiente de execução*.
3. Rode as células em ordem. O padrão usa o dataset do Kaggle `andrewmvd/pothole-detection`, que não pede chave. Para usar o Roboflow, coloque `ROBOFLOW_API_KEY` nos *Secrets* do Colab e preencha workspace/projeto/versão.
4. No fim, baixe `modelo_buraco.zip` e copie `buraco.onnx` e `buraco.labels.json` para `web/public/modelos/`.

> ⚠️ Confira a licença de cada dataset antes de usar (a maioria no Roboflow Universe é CC BY 4.0, que exige atribuição).

## Rodando localmente (CPU, sem GPU)

Serve para exportar e validar modelos. Treinar em CPU é lento demais.

```bash
python -m venv .venv
```
```bash
.venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```
```bash
.venv/Scripts/python -m pip install -r requirements.txt
```

Modelo **provisório** (COCO, 80 classes) para desenvolver o app antes do modelo de buracos ficar pronto:

```bash
.venv/Scripts/python scripts/exportar_onnx.py --pesos yolo11n.pt --nome provisorio_coco
```

Validar um ONNX e medir o tempo:

```bash
.venv/Scripts/python scripts/verificar_onnx.py --modelo exportados/provisorio_coco.onnx --imagem foto.jpg --bench 30
```

## Estratégia do modelo (resumo; detalhes em `docs/decisoes.md`)

- **Um modelo único, só com as nossas classes.** O treino parte dos pesos do COCO, mas a cabeça é recriada com `nc` = nossas classes. Dois modelos em sequência dobrariam a latência por frame no navegador, que é o gargalo do app.
- O modelo "esquece" as classes do COCO, e isso é aceitável: pessoas e carros a bengala e a audição já cobrem. Se alguma classe do COCO fizer falta, ela entra **no mesmo dataset combinado** (via `mapa_classes`), nunca como segundo modelo.
- **Adicionar `obstaculo_suspenso`:** descomente a classe em `config/dataset.yaml` (sempre no FIM da lista), acrescente a fonte própria anotada no Roboflow e treine de novo. O app lê as classes do `labels.json`, então não é preciso mudar código.
- **Treino em 320×320**, a mesma resolução da inferência no celular.
- Os aumentos de dados respeitam a câmera no peito: espelhamento horizontal sim, vertical não (o chão sempre fica embaixo), leve rotação (balanço do corpo) e variação de brilho (sol e sombra).

## Formato do ONNX exportado

| | |
|---|---|
| Entrada | `images` `[1, 3, 320, 320]` float32 RGB 0–1, letterbox com cinza 114 |
| Saída | `output0` `[1, 4 + nc, 2100]`: `cx, cy, w, h` em pixels do input + score por classe (já com sigmoid) |
| NMS | **fora** do modelo (feito em TypeScript no app) |
| Tamanho | ~10,6 MB (yolo11n FP32) |

O `labels.json` traz `classes`, `nomes_falados` (pt-BR, usado na voz), `imgsz` e os formatos de entrada e saída.

## Validação feita

- `provisorio_coco.onnx` exportado com sucesso: saída `[1, 84, 2100]`.
- Decodificação + NMS do `verificar_onnx.py` comparados com o `predict` do Ultralytics na imagem `bus.jpg`: mesmos 4 objetos, caixas e scores próximos. As pequenas diferenças vêm do padding do letterbox.
- CPU de PC, 1 thread: **~23 ms/frame** a 320. É só referência. **O tempo no celular deve ser medido na página `?bench` do app** e registrado em `docs/desempenho.md`.
- `preparar_dataset.py` testado com dados sintéticos: remapeamento de classes, descarte das não mapeadas, polígono→bbox e VOC→YOLO.
- `treinar.py` executado por 1 época em CPU (teste de fumaça). As métricas reais saem do Colab.

## Limitação importante: diferença de domínio

Datasets públicos de buracos são quase todos de **rua, vistos do carro**. O app vê **calçada, da altura do peito, inclinado para o chão**. Para a demo, recomenda-se fotografar de 100 a 200 imagens em calçadas de Recife com o celular no suporte, anotar no Roboflow e incluir como fonte `calcadas_recife`.
