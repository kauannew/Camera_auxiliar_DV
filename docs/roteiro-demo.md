# Roteiro da demo (pitch, ~5 min)

## Antes (checklist)
- [ ] Backend rodando com o seed (`python -m app.seed`) e build do app atualizado (`npm run build`).
- [ ] Túnel ativo (`cloudflared tunnel --url http://localhost:8000`); URL aberta **uma vez no Wi-Fi** no celular, para cachear o modelo.
- [ ] Celular Android + Chrome, volume alto, vibração ligada, modo economia de bateria **desligado**.
- [ ] Suporte de peito ajustado e calibração conferida (`docs/calibracao.md`).
- [ ] Notebook com `/mapa` aberto no projetor, centralizado em Recife.
- [ ] Obstáculo de palco: foto impressa de buraco em tamanho grande, no chão (com o modelo de buracos), ou um objeto que o modelo provisório detecte.
- [ ] Plano B gravado: vídeo de 30 s andando na calçada com o app no modo calibração.

## Roteiro

**1. O problema (40 s).** A bengala percebe o que toca. O buraco só aparece quando a ponta cai nele, e o galho na altura da cabeça nunca aparece. Em Recife, calçada irregular é regra.

**2. A solução (30 s).** Celular no peito, câmera para a frente. Uma IA roda **no próprio celular** (sem internet, sem atraso) e avisa por vibração e voz. É **complemento da bengala, não substituto**.

**3. Demo ao vivo (90 s).**
1. Um integrante veste o suporte e toca em **Iniciar**. O app fala: "Monitoramento ativo. Use sempre a bengala."
2. Ele caminha em direção ao obstáculo no chão. Primeiro vem a vibração lenta e "Buraco à frente, a poucos passos". Mais perto, vibração rápida e "Buraco à frente, perto".
3. Ele desvia para o lado: o alerta para (o objeto saiu do corredor de caminhada).
4. Mostre o modo calibração no projetor: caixas, corredor verde, linhas de distância.

**4. O mapa colaborativo (60 s).**
1. Troque para `/mapa`: aparece o ponto novo (a detecção da demo, se houver GPS) junto dos pontos de Recife.
2. As cores mostram quantas vezes o ponto foi confirmado (amarelo → laranja → vermelho). Cada usuário que passa reforça o dado.
3. Esse dado vale para **a prefeitura** (manutenção priorizada) e para **rotas acessíveis**.

**5. Robustez (30 s).** Confirma em vários quadros antes de alertar (menos alarme falso). Um alerta por vez, com o mais perto primeiro. Se a detecção travar, o app **avisa**: silêncio nunca significa "caminho livre". Sem internet, as detecções ficam na fila e sobem depois.

**6. Roadmap (30 s).** Rotas que evitam os pontos do mapa; obstáculos suspensos (placas, galhos); profundidade real (Depth Anything / sensores); app nativo rodando em segundo plano, reaproveitando o núcleo e o modelo.

## Perguntas prováveis
- **Bateria?** Inferência a 4 FPS em 320×320. Medir no `?bench` e trazer o número; no nativo cai bastante.
- **E o iPhone?** Funciona com voz e bipes (o Safari não vibra); o foco da demo é Android.
- **Privacidade?** Nenhuma imagem sai do celular. Só classe, coordenada, confiança e horário.
- **Licença?** YOLO da Ultralytics é AGPL: ok para projeto aberto; para produto comercial, licença Enterprise ou troca por modelo Apache (`docs/licencas.md`).
