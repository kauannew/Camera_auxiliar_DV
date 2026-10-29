# Câmera Auxiliar DV

> 🚀 **Aplicação Online (Vercel):** [https://camera-auxiliar-dv.vercel.app](https://camera-auxiliar-dv.vercel.app)  
> 🗺️ **Mapa Colaborativo:** [https://camera-auxiliar-dv.vercel.app/mapa](https://camera-auxiliar-dv.vercel.app/mapa)  
> 📋 **Documentação Swagger (API Render):** [https://camera-auxiliar-dv-backend.onrender.com/docs](https://camera-auxiliar-dv-backend.onrender.com/docs)

> [!NOTE]
> **Nota de Homologação:** Todas as funcionalidades de negócio, acessibilidade (WCAG 2.2 AAA), integração do motor de IA (YOLO11n ONNX), rotas nacionais e interface foram concluídas e homologadas dentro do prazo do hackathon (até 26/10/2026). As atualizações posteriores foram de caráter estritamente operacional de infraestrutura e hospedagem (configuração de runtime `.python-version` no Render e arquivo de proxy reverso `vercel.json`), sem qualquer alteração lógica ou de escopo na aplicação.

App de navegação assistiva para pessoas com deficiência visual (hackathon de Mobilidade e Soluções Urbanas).

Com o celular preso no **peito**, a câmera detecta **buracos** que a bengala percebe mal e avisa por **vibração e voz em pt-BR**. Cada obstáculo confirmado vai com GPS para um **mapa colaborativo** de pontos problemáticos, base para rotas mais acessíveis no futuro.

> É um **complemento à bengala, não um substituto**.

| Pasta | O quê |
|---|---|
| [`training/`](training/README.md) | Fine-tuning do YOLO11n (Colab) e export para ONNX |
| [`web/`](web/README.md) | PWA (TypeScript + Vite + ONNX Runtime Web): câmera → IA no aparelho → alertas → fila offline |
| [`backend/`](backend/README.md) | FastAPI + SQLite: recebe detecções, funde pontos a 5 m, mapa Leaflet, serve o PWA |
| [`docs/`](docs/arquitetura.md) | Arquitetura, decisões, calibração, limitações, licenças, roteiro da demo |

## Rodar tudo em 4 comandos

```bash
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m app.seed
```
```bash
cd web && npm install && npm run build
```
```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
```bash
cloudflared tunnel --url http://localhost:8000
```

Abra a URL `https://….trycloudflare.com` no Chrome do Android (app em `/`, mapa em `/mapa`).

⚠️ **Licença:** a Ultralytics (YOLO) é AGPL-3.0. Veja [`docs/licencas.md`](docs/licencas.md) antes de qualquer uso comercial.
