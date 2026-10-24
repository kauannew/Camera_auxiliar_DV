package br.labai.rotas.rota;

import br.labai.rotas.obstaculo.Obstaculo;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** Corpo do POST /api/rota: igual ao GET, mais obstáculos simulados que não são guardados. */
public record RotaPedido(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        Ponto origem,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        Ponto destino,
        @Schema(description = "foot-walking (padrão, a pé) ou wheelchair (cadeira de rodas)", example = "foot-walking")
        String perfil,
        @Schema(description = "false para ver a rota sem desviar de nada (comparação); padrão true", example = "true")
        Boolean considerarObstaculos,
        @Schema(description = "true devolve também rotaSemDesvio, sem gastar chamada extra; padrão false", example = "false")
        Boolean incluirRotaSemDesvio,
        @Schema(description = "Obstáculos simulados (até 50), somados aos da câmera só neste pedido")
        List<Obstaculo> obstaculos
) {
}
