# Licenças: pontos de atenção

> Não é parecer jurídico. Antes de qualquer uso comercial, consultar um advogado.

## ⚠️ Ultralytics (YOLO): AGPL-3.0
- A biblioteca `ultralytics` e os pesos oficiais (`yolo11n.pt`, `yolov8n.pt`) são distribuídos sob **AGPL-3.0**.
- A AGPL estende a obrigação de abrir o código ao **uso via rede**: se um serviço usa o software modificado, quem acessa pela rede tem direito ao código-fonte correspondente.
- Na própria interpretação da Ultralytics, modelos treinados a partir dos pesos dela e o software que os incorpora ficam sujeitos à AGPL. Para uso fechado ou comercial, ela vende a **Ultralytics Enterprise License**.
- **Hackathon / código aberto:** sem problema, desde que o repositório continue público sob licença compatível com a AGPL.
- **Caminhos para um produto comercial fechado:**
  1. Comprar a licença Enterprise da Ultralytics.
  2. Trocar por um detector com licença permissiva (Apache-2.0/MIT), por exemplo RT-DETR (implementação original da Baidu), YOLOX ou YOLOv6 (Apache-2.0), e treinar de novo com o mesmo dataset. O app web não muda: ele só consome um ONNX com saída de detecções. Talvez seja preciso ajustar o decodificador em `web/src/core/posprocessamento.ts`.

## Datasets
- Cada dataset do Roboflow Universe ou do Kaggle tem licença própria, em geral **CC BY 4.0** (exige atribuição). Registrar aqui os datasets usados no modelo final, com link e licença.
- Fotos próprias tiradas na rua: evitar rostos e placas de carro identificáveis, ou borrá-los antes de publicar o dataset (LGPD).

| Dataset | Link | Licença | Usado no modelo |
|---|---|---|---|
| Pothole Detection (andrewmvd) | kaggle.com/datasets/andrewmvd/pothole-detection | conferir na página | padrão do notebook |

## Demais dependências
- ONNX Runtime Web: MIT. Leaflet: BSD-2. Tiles do OpenStreetMap: dados ODbL, atribuição obrigatória no mapa e política de uso justo dos tiles (para produção, usar um provedor próprio). FastAPI e SQLAlchemy: MIT.
