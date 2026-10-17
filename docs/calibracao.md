# Calibração da heurística de distância

Os limiares ficam em `web/src/core/config.ts`. A calibração leva uns 15 minutos e precisa de uma trena (ou passos contados), fita crepe e um objeto que o modelo detecte. Com o modelo provisório, uma garrafa ou uma mochila no chão servem.

## 1. Montagem
- Celular **no suporte de peito**, na mesma posição do uso real. A altura e a inclinação mudam tudo.
- Abra `https://<túnel>/?debug=1` e toque em **Iniciar**. O modo calibração mostra:
  - faixa verde = corredor central (mais clara = com margem);
  - linhas tracejadas brancas = fronteiras esquerda/centro/direita;
  - linhas vermelha e laranja = limites de **perto** e **médio** (`baseYPerto`, `baseYMedio`).

## 2. Distância
1. Marque no chão, com fita, **1,5 m** e **3 m** à frente dos pés.
2. Coloque o objeto na marca de 1,5 m. A base da caixa deve tocar a **linha vermelha** (perto). Se ficar acima ou abaixo, ajuste `distancia.baseYPerto`.
3. Repita na marca de 3 m com a **linha laranja** (`distancia.baseYMedio`).
4. Ande devagar em direção ao objeto. A caixa deve passar de amarelo (longe) para laranja (médio) e depois vermelho (perto), sem pular.

Por que 1,5 m e 3 m: andando a ~1,2 m/s, "perto" deixa cerca de 1 s de reação e "médio" cerca de 2,5 s.

## 3. Corredor
1. Coloque o objeto a ~2 m, deslocado 40 cm para a esquerda do centro do corpo. Ele deve **encostar** na faixa verde clara (alerta "à frente, à esquerda").
2. A 80 cm para o lado, ele deve ficar **fora** do corredor (só gera aviso "ao lado" se estiver perto).
3. Ajuste `zonas.corredorInicio`, `zonas.corredorFim` e `zonas.corredorMargem`.

## 4. Ruído e falsos positivos
- Se houver alertas falsos, suba `confirmacao.quadros` (3 → 4) ou `modelo.confMin` (0,40 → 0,50).
- Se o alerta chegar tarde, desça `confirmacao.quadrosPerto` (2 → 1) ou suba `captura.fpsAlvo`, se o aparelho aguentar (veja `?bench`).
- Se falar demais, suba `alertas.cooldownObstaculoMs` ou `alertas.intervaloEntreFalasMs`.

## 5. Registre
Anote os valores finais e o aparelho/suporte usados neste arquivo:

| Data | Aparelho | Suporte/altura | baseYPerto | baseYMedio | corredor | Obs. |
|---|---|---|---|---|---|---|
| | | | 0,68 | 0,42 | 0,30–0,70 ±0,05 | valores teóricos iniciais |
