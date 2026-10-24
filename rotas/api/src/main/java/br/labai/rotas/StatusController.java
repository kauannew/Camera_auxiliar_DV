package br.labai.rotas;

import br.labai.rotas.obstaculo.FonteObstaculos;
import br.labai.rotas.ors.MotorOrs;
import br.labai.rotas.ors.OrsClient;
import br.labai.rotas.rota.AreaAtendida;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

@RestController
@Tag(name = SwaggerConfig.TAG_STATUS)
public class StatusController {

    private static final Logger log = LoggerFactory.getLogger(StatusController.class);

    private final OrsClient ors;
    private final FonteObstaculos obstaculos;
    private final AreaAtendida area;

    public StatusController(OrsClient ors, FonteObstaculos obstaculos, AreaAtendida area) {
        this.ors = ors;
        this.obstaculos = obstaculos;
        this.area = area;
    }

    @Operation(summary = "Ver se está tudo funcionando",
            description = """
                    **Para que serve:** diz se a API está no ar e se ela consegue falar com cada peça: \
                    os motores de rota (`salvador` e `publico`) e a câmera. Não calcula rota, então não gasta cota.

                    **Quem usa:** a equipe e quem monitora a API. `/api/status` é o mesmo endpoint.""")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = ExemplosApi.HEALTH)))
    @GetMapping({"/api/status", "/health"})
    public Map<String, Object> status() {
        Map<String, String> motores = new LinkedHashMap<>();
        ors.motores().forEach(m -> motores.put(m.nome(), estado(m)));
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("api", "ok");
        resposta.put("ors", motores);
        resposta.put("camera", obstaculos.estado());
        return resposta;
    }

    @Operation(summary = "Ver a área onde a API calcula rotas",
            description = """
                    **Para que serve:** devolve as áreas onde a API aceita origem e destino: `areas` traz o nome e o \
                    retângulo (`[minLon, minLat, maxLon, maxLat]`) de cada uma; `bbox` é o da primeira, e `null` quer \
                    dizer o mundo todo. Fora delas, ou com origem e destino em áreas diferentes, a rota dá erro 400.

                    **Quem usa:** o front, se quiser limitar o mapa.""")
    @GetMapping("/api/area")
    public Map<String, Object> area() {
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("nome", area.nome());
        resposta.put("bbox", area.bbox());
        resposta.put("areas", area.areas());
        return resposta;
    }

    /** Não pede rota: na API pública isso gastaria cota a cada verificação. */
    private String estado(MotorOrs motor) {
        try {
            Map<?, ?> health = motor.cliente().get().uri("/v2/health").retrieve().body(Map.class);
            return health == null ? "sem resposta" : String.valueOf(health.get("status"));
        } catch (RestClientResponseException e) {
            // A API pública não tem /v2/health (404), mas responder já mostra que está no ar.
            // Outro status (ex.: 503 de um ORS próprio ainda carregando) é problema de verdade
            return e.getStatusCode().value() == 404 ? "ok" : "erro HTTP " + e.getStatusCode().value();
        } catch (ResourceAccessException e) {
            // Detalhe só no log: a mensagem traz endereços internos
            log.warn("ORS {} inacessível: {}", motor.nome(), e.getMessage());
            return "inacessível";
        }
    }
}
