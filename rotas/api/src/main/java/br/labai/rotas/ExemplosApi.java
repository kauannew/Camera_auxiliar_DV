package br.labai.rotas;

/**
 * Exemplos de JSON mostrados no Swagger. Tirados de respostas reais da API (Terreiro de Jesus até a
 * Praça da Sé, cadeira de rodas), com a geometria encurtada.
 */
public final class ExemplosApi {

    private ExemplosApi() {
    }

    public static final String PEDIDO_SIMULADO = """
            {
              "origem": { "latitude": -12.9737, "longitude": -38.5094 },
              "destino": { "latitude": -12.9732, "longitude": -38.5119 },
              "perfil": "wheelchair",
              "obstaculos": [
                { "latitude": -12.973495, "longitude": -38.511139, "passagem": "bloqueada", "tipo": "degrau" }
              ]
            }""";

    public static final String ROTA_COM_DESVIO = """
            {
              "distanciaMetros": 537,
              "duracaoSegundos": 387,
              "geometria": { "type": "LineString", "coordinates": [[-38.509579, -12.973823], [-38.509734, -12.973609], [-38.50989, -12.973431]] },
              "instrucoes": [
                { "texto": "Siga para noroeste em direção a Largo do Cruzeiro do São Francisco", "distanciaMetros": 29 },
                { "texto": "Vire ligeiramente à esquerda em direção a Rua da Ajuda", "distanciaMetros": 30 },
                { "texto": "Chegar a Ladeira da Misericórdia, à direita", "distanciaMetros": 0 }
              ],
              "obstaculosEvitados": 1,
              "desvioPossivel": true,
              "motor": "salvador"
            }""";

    public static final String ROTA_COM_AVISO = """
            {
              "distanciaMetros": 558,
              "duracaoSegundos": 402,
              "geometria": { "type": "LineString", "coordinates": [[-38.509579, -12.973823], [-38.509734, -12.973609], [-38.50989, -12.973431]] },
              "instrucoes": [
                { "texto": "Vire à direita", "distanciaMetros": 72 },
                { "texto": "Atenção: degrau em cerca de 50 metros. Dá para contornar.", "distanciaMetros": 0 },
                { "texto": "Vire à direita", "distanciaMetros": 42 }
              ],
              "obstaculosEvitados": 0,
              "desvioPossivel": true,
              "motor": "salvador"
            }""";

    public static final String ROTA_SEM_DESVIO_POSSIVEL = """
            {
              "distanciaMetros": 558,
              "duracaoSegundos": 402,
              "geometria": { "type": "LineString", "coordinates": [[-38.509579, -12.973823], [-38.509734, -12.973609], [-38.50989, -12.973431]] },
              "instrucoes": [
                { "texto": "Vire à direita em direção a Ladeira da Misericórdia", "distanciaMetros": 145 },
                { "texto": "Atenção: obra em cerca de 120 metros. Passagem bloqueada, sem desvio possível.", "distanciaMetros": 0 },
                { "texto": "Chegar a Ladeira da Misericórdia, à direita", "distanciaMetros": 0 }
              ],
              "obstaculosEvitados": 0,
              "desvioPossivel": false,
              "motor": "salvador"
            }""";

    public static final String ERRO_FORA_DA_AREA = """
            { "erro": "destino fora da área atendida (Centro Histórico de Salvador)." }""";

    public static final String ERRO_FORMATO = """
            { "erro": "origem deve estar no formato lat,lon (ex.: -12.9737,-38.5094)" }""";

    public static final String ERRO_BBOX = """
            { "erro": "bbox deve ser minLon,minLat,maxLon,maxLat (ex.: -38.516,-12.983,-38.501,-12.964)" }""";

    public static final String ERRO_SEM_CAMINHO = """
            { "erro": "Não existe caminho entre a origem e o destino com esse perfil." }""";

    public static final String ERRO_CAMERA = """
            { "erro": "Dados de obstáculos indisponíveis no momento. Tente de novo em instantes." }""";

    public static final String ERRO_COTA = """
            { "erro": "Limite de pedidos de rota atingido. Tente de novo em alguns minutos." }""";

    public static final String OBSTACULOS = """
            [
              { "latitude": -12.973788, "longitude": -38.509894, "passagem": "bloqueada", "tipo": "buraco", "confianca": 0.9 },
              { "latitude": -12.973495, "longitude": -38.511139, "passagem": "contornavel", "tipo": "degrau", "confianca": null }
            ]""";

    public static final String HEALTH = """
            { "api": "ok", "ors": { "salvador": "ready", "publico": "ok" }, "camera": "ok" }""";
}
