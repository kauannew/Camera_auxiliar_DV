package br.labai.rotas.obstaculo;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * De onde vêm os obstáculos. A API não guarda nada: a cada rota pergunta ao back da câmera
 * (CAMERA_URL) o que há dentro do retângulo. Com CAMERA_URL vazio, usa os obstáculos de
 * teste fixos de obstaculos-teste.json.
 */
@Component
public class FonteObstaculos {

    private static final Logger log = LoggerFactory.getLogger(FonteObstaculos.class);

    private final String url;
    private final RestClient camera;
    private final List<Obstaculo> fixos;
    private final Map<String, Passagem> porClasse;

    public FonteObstaculos(@Value("${camera.url:}") String url,
                           @Value("${camera.passagem-por-classe:}") String porClasse, ObjectMapper json) throws IOException {
        this.url = url.isBlank() ? null : url.trim();
        this.porClasse = lerPorClasse(porClasse);
        log.info("Nível por classe da câmera: {} (as outras valem bloqueada)", this.porClasse);
        var tempos = new SimpleClientHttpRequestFactory();
        tempos.setConnectTimeout(Duration.ofSeconds(3));
        tempos.setReadTimeout(Duration.ofSeconds(5));
        this.camera = RestClient.builder().requestFactory(tempos).build();
        if (this.url == null) {
            try (InputStream arquivo = new ClassPathResource("obstaculos-teste.json").getInputStream()) {
                this.fixos = converter(json.readTree(arquivo), this.porClasse);
            }
            log.info("CAMERA_URL vazio: usando {} obstáculos de teste fixos", fixos.size());
        } else {
            this.fixos = List.of();
            log.info("Obstáculos vêm de {}", this.url);
        }
    }

    /** Obstáculos dentro do retângulo (graus). */
    public List<Obstaculo> dentro(double minLon, double minLat, double maxLon, double maxLat) {
        List<Obstaculo> todos = url == null ? fixos : daCamera(minLon, minLat, maxLon, maxLat);
        // Filtra aqui também, caso a câmera ignore o bbox e devolva tudo
        return todos.stream()
                .filter(o -> o.latitude() >= minLat && o.latitude() <= maxLat
                        && o.longitude() >= minLon && o.longitude() <= maxLon)
                .toList();
    }

    /** Para o /health. O motivo da falha fica só no log, para não expor endereços internos. */
    public String estado() {
        if (url == null) {
            return "obstáculos de teste fixos (CAMERA_URL vazio)";
        }
        try {
            // Retângulo minúsculo: só confere se a câmera responde
            daCamera(0, 0, 0.0001, 0.0001);
            return "ok";
        } catch (CameraIndisponivelException e) {
            return "inacessível";
        }
    }

    private List<Obstaculo> daCamera(double minLon, double minLat, double maxLon, double maxLat) {
        // bbox na ordem do GeoJSON: minLon,minLat,maxLon,maxLat
        // 6 casas (~10 cm) e sempre com ponto, nunca em notação científica
        String bbox = String.format(Locale.ROOT, "%.6f,%.6f,%.6f,%.6f", minLon, minLat, maxLon, maxLat);
        URI uri = UriComponentsBuilder.fromUriString(url)
                .queryParam("bbox", bbox)
                .build().toUri();
        JsonNode lista;
        try {
            lista = camera.get().uri(uri).retrieve().body(JsonNode.class);
        } catch (RestClientException e) {
            log.warn("Falha ao buscar obstáculos em {}: {}", uri, e.getMessage());
            throw new CameraIndisponivelException(e.getMessage());
        }
        if (lista != null && !lista.isArray()) {
            log.warn("Resposta de {} não é uma lista: {}", uri, abreviar(lista));
            throw new CameraIndisponivelException("a resposta da câmera não é uma lista");
        }
        return lista == null ? List.of() : converter(lista, porClasse);
    }

    /**
     * Converte item a item: um registro ruim é descartado (com log) em vez de derrubar todas as rotas.
     * Sem coordenadas não há como usar o obstáculo; passagem desconhecida vale como bloqueada (o lado seguro).
     */
    static List<Obstaculo> converter(JsonNode lista, Map<String, Passagem> porClasse) {
        List<Obstaculo> obstaculos = new ArrayList<>();
        int semNivel = 0;
        for (JsonNode item : lista) {
            // Aceita os nomes do back da câmera (lat, lng, classe, confianca_media) além dos do contrato
            JsonNode lat = primeiro(item, "latitude", "lat");
            JsonNode lon = primeiro(item, "longitude", "lng", "lon");
            if (!lat.isNumber() || !lon.isNumber() || !Double.isFinite(lat.asDouble()) || !Double.isFinite(lon.asDouble())
                    || Math.abs(lat.asDouble()) > 90 || Math.abs(lon.asDouble()) > 180) {
                log.warn("Obstáculo descartado, sem latitude e longitude válidas: {}", abreviar(item));
                continue;
            }
            String classe = item.path("classe").isString() ? item.path("classe").asString().trim().toLowerCase(Locale.ROOT) : null;
            Passagem passagem;
            String textoPassagem = item.path("passagem").isString() ? item.path("passagem").asString() : null;
            if (textoPassagem != null) {
                try {
                    passagem = Passagem.de(textoPassagem);
                } catch (IllegalArgumentException e) {
                    log.warn("Passagem desconhecida \"{}\", tratada como bloqueada: {}", textoPassagem, abreviar(item));
                    passagem = Passagem.BLOQUEADA;
                }
            } else if (classe != null && porClasse.containsKey(classe)) {
                passagem = porClasse.get(classe);
            } else {
                // Sem passagem e sem classe conhecida: o mais seguro é tratar como bloqueada
                passagem = Passagem.BLOQUEADA;
                semNivel++;
            }
            String tipo = item.path("tipo").isString() ? item.path("tipo").asString() : nomeLegivel(classe);
            JsonNode conf = primeiro(item, "confianca", "confianca_media");
            Double confianca = conf.isNumber() ? conf.asDouble() : null;
            obstaculos.add(new Obstaculo(lat.asDouble(), lon.asDouble(), passagem, tipo, confianca));
        }
        if (semNivel > 0) {
            // Um aviso por resposta, não por registro, para não encher o log a cada rota
            log.warn("{} obstáculos sem passagem nem classe em CAMERA_PASSAGEM_POR_CLASSE, tratados como bloqueados", semNivel);
        }
        return obstaculos;
    }

    /** O primeiro campo presente, entre nomes alternativos. */
    private static JsonNode primeiro(JsonNode item, String... nomes) {
        for (String nome : nomes) {
            if (item.has(nome)) {
                return item.path(nome);
            }
        }
        return item.path(nomes[0]);
    }

    /** "obstaculo_suspenso" vira "obstáculo suspenso" no texto do aviso (que pode ser lido por voz). */
    static String nomeLegivel(String classe) {
        if (classe == null) {
            return null;
        }
        return classe.replace('_', ' ').replace("obstaculo", "obstáculo");
    }

    /**
     * Lê CAMERA_PASSAGEM_POR_CLASSE ("obstaculo_suspenso:bloqueada,buraco:dificil"). Entrada malformada
     * derruba a API na subida, para o erro aparecer logo e não numa rota errada.
     */
    static Map<String, Passagem> lerPorClasse(String texto) {
        Map<String, Passagem> mapa = new HashMap<>();
        for (String par : texto.split(",")) {
            if (par.isBlank()) {
                continue;
            }
            String[] partes = par.split(":");
            if (partes.length != 2 || partes[0].isBlank()) {
                throw new IllegalArgumentException("CAMERA_PASSAGEM_POR_CLASSE: use classe:nivel, veio \"" + par.trim() + "\"");
            }
            try {
                mapa.put(partes[0].trim().toLowerCase(Locale.ROOT), Passagem.de(partes[1]));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("CAMERA_PASSAGEM_POR_CLASSE: nível desconhecido \"" + partes[1].trim()
                        + "\" (use bloqueada, dificil ou contornavel)");
            }
        }
        return Map.copyOf(mapa);
    }

    private static String abreviar(JsonNode no) {
        String texto = no.toString();
        return texto.length() > 200 ? texto.substring(0, 200) + "..." : texto;
    }
}
