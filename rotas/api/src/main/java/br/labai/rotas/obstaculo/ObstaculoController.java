package br.labai.rotas.obstaculo;

import br.labai.rotas.ExemplosApi;
import br.labai.rotas.SwaggerConfig;
import br.labai.rotas.rota.AreaAtendida;
import br.labai.rotas.rota.ParametroInvalidoException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Só leitura: repassa o que vem da câmera, para desenhar no mapa. A API não guarda obstáculos. */
@RestController
@Tag(name = SwaggerConfig.TAG_OBSTACULOS)
public class ObstaculoController {

    private final FonteObstaculos fonte;
    private final AreaAtendida area;

    public ObstaculoController(FonteObstaculos fonte, AreaAtendida area) {
        this.fonte = fonte;
        this.area = area;
    }

    @Operation(summary = "Listar os obstáculos de uma área (para mostrar no mapa)",
            description = """
                    **Para que serve:** devolve os obstáculos registrados pela câmera dentro de um retângulo. \
                    Só repassa o que vem da câmera: não cria nem apaga nada. Sem câmera ligada, devolve os de teste.

                    **Quem usa:** o front, se quiser desenhar os obstáculos.

                    **Entra:** `bbox` (o retângulo). **Sai:** a lista de obstáculos.""")
    @ApiResponse(responseCode = "200", content = @Content(mediaType = "application/json",
            array = @ArraySchema(schema = @Schema(implementation = Obstaculo.class)),
            examples = @ExampleObject(value = ExemplosApi.OBSTACULOS)))
    @ApiResponse(responseCode = "400", description = "bbox inválido", content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = ExemplosApi.ERRO_BBOX)))
    @ApiResponse(responseCode = "503", description = "Câmera fora do ar", content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = ExemplosApi.ERRO_CAMERA)))
    @GetMapping("/api/obstaculos")
    public List<Obstaculo> obstaculos(
            @Parameter(description = "`minLon,minLat,maxLon,maxLat`. Opcional quando há área atendida (usa todas)",
                    example = "-38.516,-12.983,-38.501,-12.964")
            @RequestParam(required = false) String bbox) {
        if (bbox == null) {
            if (area.areas().isEmpty()) {
                throw new ParametroInvalidoException("informe bbox: a área atendida não tem limite");
            }
            // Sem bbox: junta os obstáculos de todas as áreas atendidas
            return area.areas().stream().flatMap(a -> {
                double[] c = a.bbox();
                return fonte.dentro(c[0], c[1], c[2], c[3]).stream();
            }).toList();
        }
        double[] b;
        try {
            b = AreaAtendida.ler(bbox);
        } catch (IllegalArgumentException e) {
            throw new ParametroInvalidoException("bbox deve ser minLon,minLat,maxLon,maxLat (ex.: -38.516,-12.983,-38.501,-12.964)");
        }
        return fonte.dentro(b[0], b[1], b[2], b[3]);
    }
}
