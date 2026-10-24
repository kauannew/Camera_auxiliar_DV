package br.labai.rotas.ors;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Chama o endpoint de direções do ORS e devolve só o que a API usa. Com mais de um motor (ORS próprio de
 * Salvador e API pública), usa o primeiro que cobre origem e destino e passa para o próximo se ele estiver
 * fora do ar, sem cota ou com erro de servidor.
 */
@Component
public class OrsClient {

    private static final Logger log = LoggerFactory.getLogger(OrsClient.class);

    private final List<MotorOrs> motores;
    private final ObjectMapper json;

    public OrsClient(List<MotorOrs> motoresOrs, ObjectMapper json) {
        this.motores = motoresOrs;
        this.json = json;
    }

    public List<MotorOrs> motores() {
        return motores;
    }

    /**
     * @param evitar anéis fechados em [lon, lat] para evitar; lista vazia para nenhum
     */
    public RotaOrs rota(String perfil, double[] origem, double[] destino, List<List<double[]>> evitar) {
        List<MotorOrs> candidatos = motores.stream().filter(m -> m.cobre(origem, destino)).toList();
        RuntimeException ultimoErro = null;
        for (MotorOrs motor : candidatos) {
            try {
                return rota(motor, perfil, origem, destino, evitar);
            } catch (OrsException e) {
                if (!e.isIndisponivel()) {
                    throw e; // "sem caminho", "ponto fora do mapa": outro motor responderia o mesmo
                }
                ultimoErro = e;
            } catch (ResourceAccessException e) {
                ultimoErro = e;
            }
            log.warn("Motor {} indisponível ({}); tentando o próximo", motor.nome(), ultimoErro.getMessage());
        }
        throw ultimoErro;
    }

    private RotaOrs rota(MotorOrs motor, String perfil, double[] origem, double[] destino, List<List<double[]>> evitar) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("coordinates", List.of(origem, destino));
        corpo.put("instructions", true);
        corpo.put("language", "pt");
        if (!evitar.isEmpty()) {
            // MultiPolygon: cada polígono é uma lista de anéis; aqui só o anel externo
            List<List<List<double[]>>> multi = evitar.stream().map(List::of).toList();
            corpo.put("options", Map.of("avoid_polygons", Map.of("type", "MultiPolygon", "coordinates", multi)));
        }

        JsonNode resposta;
        try {
            resposta = motor.cliente().post()
                    .uri("/v2/directions/{perfil}/geojson", perfil)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corpo)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw erroDoOrs(e);
        }
        return ler(resposta, motor.nome());
    }

    private OrsException erroDoOrs(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        // 429 é a cota por minuto; a cota diária pode vir como 403 com "quota" na mensagem
        if (status == 429 || (status == 403 && e.getResponseBodyAsString().toLowerCase(Locale.ROOT).contains("quota"))) {
            return new OrsException(OrsException.COTA_ESGOTADA, "cota da API pública esgotada (HTTP " + status + ")");
        }
        if (status == 401 || status == 403) {
            return new OrsException(OrsException.CHAVE_INVALIDA, "ORS_API_KEY ausente ou inválida");
        }
        try {
            JsonNode erro = json.readTree(e.getResponseBodyAsString()).path("error");
            // 5xx é problema do servidor, não do pedido: vale tentar outro motor
            return new OrsException(erro.path("code").asInt(), erro.path("message").asString(e.getMessage()), status >= 500);
        } catch (Exception ignorada) {
            return new OrsException(0, e.getMessage(), status >= 500);
        }
    }

    private static RotaOrs ler(JsonNode resposta, String motor) {
        JsonNode rota = resposta.path("features").path(0);
        JsonNode resumo = rota.path("properties").path("summary");

        List<double[]> coordenadas = new ArrayList<>();
        for (JsonNode c : rota.path("geometry").path("coordinates")) {
            coordenadas.add(new double[] {c.get(0).asDouble(), c.get(1).asDouble()});
        }

        List<RotaOrs.Passo> passos = new ArrayList<>();
        for (JsonNode segmento : rota.path("properties").path("segments")) {
            for (JsonNode passo : segmento.path("steps")) {
                passos.add(new RotaOrs.Passo(passo.path("instruction").asString(), passo.path("distance").asDouble(),
                        passo.path("way_points").path(0).asInt()));
            }
        }
        return new RotaOrs(resumo.path("distance").asDouble(), resumo.path("duration").asDouble(), coordenadas, passos, motor);
    }
}
