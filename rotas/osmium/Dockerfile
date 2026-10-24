# osmium-tool do repositório oficial do Debian (amd64 e arm64)
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends osmium-tool \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /dados
ENTRYPOINT ["osmium"]
