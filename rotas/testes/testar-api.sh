#!/usr/bin/env bash
# Testa a API de ponta a ponta. Uso: ./testes/testar-api.sh [url_base]  (padrão: http://localhost:8080)
# Gasta umas 20 chamadas da cota do ORS.
B="${1:-http://localhost:8080}"
O='{"latitude":-12.9737,"longitude":-38.5094}'
D='{"latitude":-12.9732,"longitude":-38.5119}'
# Ponto no meio da rota de cadeira do Terreiro de Jesus até a Praça da Sé (a pé a rota passa por outra rua,
# por isso os testes com obstáculo simulado pedem perfil wheelchair)
OBS_LAT=-12.973495; OBS_LON=-38.511139
ok=0; falhas=0

confere() { # nome, resposta, trecho esperado
    if grep -qiF -- "$3" <<< "$2"; then ok=$((ok+1)); echo "ok    $1"
    else falhas=$((falhas+1)); echo "FALHA $1"; echo "      esperado: $3"; echo "      veio: ${2:0:300}"; fi
}
post() { curl -s -m 40 -X POST "$B/api/rota" -H 'Content-Type: application/json' -d "$1"; }
simulado() { echo "{\"origem\":$O,\"destino\":$D,\"perfil\":\"wheelchair\",\"obstaculos\":[{\"latitude\":$OBS_LAT,\"longitude\":$OBS_LON,\"passagem\":\"$1\",\"tipo\":\"degrau\"}]}"; }

confere "health" "$(curl -s -m 20 "$B/health")" '"api":"ok"'
confere "health: ORS ok" "$(curl -s -m 20 "$B/health")" '"ors":{'
confere "area" "$(curl -s "$B/api/area")" '"bbox"'
AREA=$(curl -s "$B/api/area")
if grep -q '"bbox":null' <<< "$AREA"; then
    echo "--    checagens de área puladas (AREA_BBOX vazio: mundo todo)"
else
    confere "fora das áreas" "$(curl -s "$B/api/rota?origem=-23.5,-46.6&destino=-12.9732,-38.5119")" 'fora da área atendida'
    confere "áreas diferentes" "$(curl -s "$B/api/rota?origem=-12.9737,-38.5094&destino=-8.0601,-34.8883")" 'mesma área'
fi
confere "obstaculos com bbox" "$(curl -s "$B/api/obstaculos?bbox=-38.516,-12.983,-38.501,-12.964")" '"passagem"'
confere "obstaculos bbox inválido" "$(curl -s "$B/api/obstaculos?bbox=abc")" 'bbox deve ser'

confere "GET a pé sem obstáculos" "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119&perfil=foot-walking&considerarObstaculos=false")" '"obstaculosEvitados":0,"desvioPossivel":true'
confere "GET a pé desvia dos fixos" "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119&perfil=foot-walking")" '"obstaculosEvitados":3'
confere "GET padrão (a pé)" "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119")" '"geometria":{"type":"LineString"'
confere "GET cadeira" "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119&perfil=wheelchair")" '"geometria":{"type":"LineString"'
r=$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119&incluirRotaSemDesvio=true")
confere "rotaSemDesvio quando pedida" "$r" '"rotaSemDesvio":{"distanciaMetros"'
if grep -q rotaSemDesvio <<< "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119")"; then
    confere "sem rotaSemDesvio por padrão" "veio rotaSemDesvio" "nada"
else ok=$((ok+1)); echo "ok    sem rotaSemDesvio por padrão"; fi
confere "instruções em português" "$(curl -s -m 40 "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119")" 'Siga'

confere "POST bloqueada desvia" "$(post "$(simulado bloqueada)")" '"obstaculosEvitados":1,"desvioPossivel":true'
confere "POST dificil desvia (desvio curto)" "$(post "$(simulado dificil)")" '"obstaculosEvitados":1'
r=$(post "$(simulado contornavel)")
confere "POST contornavel não desvia" "$r" '"obstaculosEvitados":0'
confere "POST contornavel avisa" "$r" 'Dá para contornar.'

confere "POST passagem com acento" "$(post "$(simulado 'dif\u00edcil')")" '"obstaculosEvitados":1'
confere "origem NaN" "$(curl -s "$B/api/rota?origem=NaN,NaN&destino=-12.9732,-38.5119")" 'latitude deve estar entre'
confere "obstáculo simulado nulo" "$(post "{\"origem\":$O,\"destino\":$D,\"obstaculos\":[null]}")" 'itens nulos'

confere "perfil inválido" "$(curl -s "$B/api/rota?origem=-12.9737,-38.5094&destino=-12.9732,-38.5119&perfil=driving-car")" 'perfil deve ser um destes'
confere "origem malformada" "$(curl -s "$B/api/rota?origem=abc&destino=-12.9732,-38.5119")" 'origem deve estar no formato lat,lon'
confere "destino faltando (GET)" "$(curl -s "$B/api/rota?origem=-12.9737,-38.5094")" 'parâmetro obrigatório: destino'
confere "destino faltando (POST)" "$(post "{\"origem\":$O}")" 'campo obrigatório: destino'
confere "passagem inválida" "$(post "{\"origem\":$O,\"destino\":$D,\"obstaculos\":[{\"latitude\":-12.97,\"longitude\":-38.51,\"passagem\":\"talvez\"}]}")" 'JSON inválido'
confere "JSON quebrado" "$(post '{"origem":')" 'JSON inválido'

confere "página de teste" "$(curl -s "$B/")" 'Teste de rotas acessíveis'
confere "Swagger UI" "$(curl -s -L "$B/swagger-ui.html")" 'swagger-ui'
confere "OpenAPI" "$(curl -s "$B/v3/api-docs")" '"/api/rota"'
confere "CORS" "$(curl -s -o /dev/null -D - -H 'Origin: https://front.exemplo.com' "$B/health")" 'Access-Control-Allow-Origin'

echo; echo "$ok ok, $falhas falha(s)"
[ "$falhas" -eq 0 ]
