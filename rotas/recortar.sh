#!/usr/bin/env bash
# Recorta a cidade do .pbf regional usando osmium via Docker.
# Uso: ./recortar.sh   (lê as variáveis do .env)
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a

OSM_DIR="$(pwd)/dados/osm"
SAIDA="${CIDADE_NOME}.osm.pbf"

if [ ! -f "$OSM_DIR/$OSM_REGIAO_ARQUIVO" ]; then
  echo "Baixando $OSM_REGIAO_URL"
  curl -sSL -o "$OSM_DIR/$OSM_REGIAO_ARQUIVO" "$OSM_REGIAO_URL"
fi

docker build -q -t rotas-osmium ./osmium >/dev/null

# MSYS_NO_PATHCONV evita que o Git Bash no Windows reescreva o caminho /dados
MSYS_NO_PATHCONV=1 docker run --rm -v "$OSM_DIR:/dados" rotas-osmium \
  extract --bbox "$CIDADE_BBOX" --strategy complete_ways --overwrite \
  -o "$SAIDA" "$OSM_REGIAO_ARQUIVO"

MSYS_NO_PATHCONV=1 docker run --rm -v "$OSM_DIR:/dados" rotas-osmium fileinfo -e "$SAIDA" \
  | grep -E 'Number of (nodes|ways|relations)'
ls -lh "$OSM_DIR/$SAIDA"
