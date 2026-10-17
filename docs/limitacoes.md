# Limitações conhecidas (fase PWA)

| Limitação | Impacto | Como tratamos | Solução definitiva |
|---|---|---|---|
| Câmera e GPS exigem **HTTPS** | Não funciona por `http://IP-da-rede` | Túnel `cloudflared tunnel --url http://localhost:8000`. O app avisa na tela e fala a mensagem | Domínio com certificado / app nativo |
| **Vibration API não existe no Safari/iOS** | Sem vibração no iPhone | Bipes WebAudio com o mesmo ritmo do padrão de vibração. A voz funciona | App nativo (Core Haptics) |
| iOS só libera a voz após um toque | A primeira fala poderia ficar muda | A voz e o áudio são "destravados" no toque em Iniciar | — |
| **Sem segundo plano**: só com a tela ligada e a aba aberta | Bloquear a tela para tudo | Wake Lock mantém a tela ligada. Ao esconder a aba, o app pausa (avisa por voz) e retoma ao voltar | App nativo com serviço em primeiro plano |
| Wake Lock pode ser negado (economia de bateria) | A tela apaga | O app continua; o vigia avisa se a detecção parar | — |
| Permissão negada (câmera/GPS) | Sem detecção / sem mapa | Mensagens faladas claras. Sem GPS, os alertas continuam e só o envio ao mapa para | — |
| Detecção travada (aba congelada, falha do modelo) | Silêncio poderia ser lido como "caminho livre" | **Vigia**: sem quadro processado por 3 s → vibração longa + "Atenção: a detecção parou" | — |
| Heurística de distância assume chão plano e celular fixo no peito | Erro em rampas, escadas ou se o celular inclinar | Calibração (`docs/calibracao.md`); faixas grossas (perto/médio/longe) | Profundidade monocular / sensores do aparelho |
| Modelo treinado com buracos de rua | Pode errar em calçadas | Fotos próprias de calçadas no treino | Dataset próprio maior |
| GPS impreciso (5–15 m; pior entre prédios) | O ponto no mapa fica deslocado | Descarta posição com precisão > 30 m ou idade > 15 s; o backend funde pontos a 5 m | Fusão com bússola/passos; correção da posição pela distância estimada |
| A posição registrada é a do usuário, não a do buraco (~1–3 m à frente) | Pequeno deslocamento | Dentro do erro do GPS; aceitável no MVP | Projetar pela direção da bússola + distância estimada |
| Leitor de tela (TalkBack) e voz do app ao mesmo tempo | Falas sobrepostas | Status sem `aria-live`; os alertas saem só pela voz do app | Canal de áudio dedicado no nativo |
| Primeira abertura baixa ~15–17 MB (modelo + runtime) | Demora no 4G | Service worker guarda em cache; abrir uma vez no Wi-Fi antes da demo | Modelo empacotado no app nativo |
| Corrida no backend: duas detecções simultâneas no mesmo lugar podem criar dois pontos | Duplicata rara no mapa | Aceitável no MVP | Restrição/lock por célula espacial no PostGIS |
