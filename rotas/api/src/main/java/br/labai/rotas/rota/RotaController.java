package br.labai.rotas.rota;

import br.labai.rotas.ExemplosApi;
import br.labai.rotas.SwaggerConfig;
import br.labai.rotas.obstaculo.Obstaculo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = SwaggerConfig.TAG_ROTAS)
public class RotaController {

    /** Cada obstáculo vira um polígono no pedido ao ORS; acima disso o pedido fica grande demais. */
    private static final int MAXIMO_SIMULADOS = 50;

    private final RotaService servico;
    private final AreaAtendida area;
    private final List<String> perfis;
    private final String perfilPadrao;

    public RotaController(RotaService servico, AreaAtendida area, @Value("${rota.perfis}") List<String> perfis,
                          @Value("${rota.perfil-padrao}") String perfilPadrao) {
        if (!perfis.contains(perfilPadrao)) {
            throw new IllegalArgumentException("ROTA_PERFIL_PADRAO (" + perfilPadrao + ") precisa estar em ROTA_PERFIS " + perfis);
        }
        this.servico = servico;
        this.area = area;
        this.perfis = perfis;
        this.perfilPadrao = perfilPadrao;
    }

    @Operation(summary = "Calcular uma rota (é o que o front usa)",
            description = """
                    **Para que serve:** dá o caminho de A até B desviando dos obstáculos que a câmera registrou.

                    **Quem usa:** o front.

                    **Entra:** `origem` e `destino` (`lat,lon`). Opcionais: `perfil`, `considerarObstaculos`, `incluirRotaSemDesvio`.

                    **Sai:** a linha da rota para desenhar no mapa, as instruções em texto com os avisos de obstáculo, \
                    distância, tempo, quantos obstáculos foram evitados, se existe rota acessível e qual motor calculou.""")
    @RespostasDeRota
    @GetMapping("/api/rota")
    public RotaResposta rota(
            @Parameter(description = "Ponto de partida, `lat,lon`", example = "-12.9737,-38.5094") @RequestParam String origem,
            @Parameter(description = "Ponto de chegada, `lat,lon`", example = "-12.9732,-38.5119") @RequestParam String destino,
            @Parameter(description = "`foot-walking` (a pé, o padrão) ou `wheelchair` (cadeira de rodas)", example = "foot-walking")
            @RequestParam(required = false) String perfil,
            @Parameter(description = "`false` devolve a rota sem desviar de nada, para comparar")
            @RequestParam(defaultValue = "true") boolean considerarObstaculos,
            @Parameter(description = "`true` devolve também `rotaSemDesvio`, sem gastar chamada extra do openrouteservice")
            @RequestParam(defaultValue = "false") boolean incluirRotaSemDesvio) {
        return calcular(Ponto.ler(origem, "origem"), Ponto.ler(destino, "destino"), perfil, considerarObstaculos,
                List.of(), incluirRotaSemDesvio);
    }

    @Operation(summary = "Calcular uma rota com obstáculos inventados (para testes)",
            description = """
                    **Para que serve:** o mesmo cálculo do GET, mas você manda obstáculos de mentira no corpo \
                    ("finja que tem um degrau aqui"). Eles valem só neste pedido e não são gravados.

                    **Quem usa:** a página de teste, ou quem quiser demonstrar o desvio sem depender da câmera.

                    **Entra:** o JSON do exemplo abaixo. **Sai:** o mesmo que o GET.""")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(mediaType = "application/json",
            examples = @ExampleObject(name = "Bloqueio no caminho", value = ExemplosApi.PEDIDO_SIMULADO)))
    @RespostasDeRota
    @PostMapping("/api/rota")
    public RotaResposta rotaSimulada(@RequestBody RotaPedido pedido) {
        List<Obstaculo> simulados = pedido.obstaculos() == null ? List.of() : pedido.obstaculos();
        if (simulados.size() > MAXIMO_SIMULADOS) {
            throw new ParametroInvalidoException("no máximo " + MAXIMO_SIMULADOS + " obstáculos simulados por pedido");
        }
        if (simulados.stream().anyMatch(Objects::isNull)) {
            throw new ParametroInvalidoException("obstaculos não pode ter itens nulos");
        }
        simulados.forEach(o -> Ponto.verificar(new Ponto(o.latitude(), o.longitude()), "obstáculo"));
        return calcular(Ponto.verificar(pedido.origem(), "origem"), Ponto.verificar(pedido.destino(), "destino"),
                pedido.perfil(),
                pedido.considerarObstaculos() == null || pedido.considerarObstaculos(), simulados,
                Boolean.TRUE.equals(pedido.incluirRotaSemDesvio()));
    }

    private RotaResposta calcular(Ponto origem, Ponto destino, String perfil, boolean considerarObstaculos,
                                  List<Obstaculo> simulados, boolean incluirRotaSemDesvio) {
        if (perfil == null || perfil.isBlank()) {
            perfil = perfilPadrao;
        }
        if (!perfis.contains(perfil)) {
            throw new ParametroInvalidoException("perfil deve ser um destes: " + String.join(", ", perfis));
        }
        // Valida antes de chamar a câmera e o ORS: ponto fora da área não gasta cota
        area.validar(origem, destino);
        return servico.calcular(origem, destino, perfil, considerarObstaculos, simulados, incluirRotaSemDesvio);
    }
}
