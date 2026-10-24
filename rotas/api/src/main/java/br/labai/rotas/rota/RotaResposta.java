package br.labai.rotas.rota;

import br.labai.rotas.ors.RotaOrs;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** Resposta do /api/rota. */
public record RotaResposta(
        @Schema(description = "Comprimento da rota devolvida, em metros", example = "537")
        long distanciaMetros,
        @Schema(description = "Tempo estimado, em segundos", example = "387")
        long duracaoSegundos,
        @Schema(description = "Linha da rota em GeoJSON, pronta para o Leaflet (L.geoJSON)")
        Geometria geometria,
        @Schema(description = "Passos em português, na ordem. Avisos de obstáculo começam com \"Atenção:\" e têm distanciaMetros 0")
        List<Instrucao> instrucoes,
        @Schema(description = "Obstáculos que estavam no caminho direto e ficaram fora da rota devolvida", example = "1")
        int obstaculosEvitados,
        @Schema(description = "false quando não há caminho que evite os obstáculos de passagem bloqueada: "
                + "a rota devolvida passa por eles e as instruções avisam onde", example = "true")
        boolean desvioPossivel,
        @Schema(description = "Quem calculou: salvador (mapa próprio, sem cota) ou publico (API pública do openrouteservice)",
                example = "salvador")
        String motor,
        @Schema(description = "Só com incluirRotaSemDesvio=true: a rota direta, sem desviar de nada, para comparar")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        Resumo rotaSemDesvio
) {

    RotaResposta comRotaSemDesvio(Resumo semDesvio) {
        return new RotaResposta(distanciaMetros, duracaoSegundos, geometria, instrucoes, obstaculosEvitados,
                desvioPossivel, motor, semDesvio);
    }

    @Schema(description = "GeoJSON LineString")
    public record Geometria(
            @Schema(example = "LineString") String type,
            @Schema(description = "Pontos em [longitude, latitude], como manda o GeoJSON")
            List<double[]> coordinates) {
    }

    public record Instrucao(
            @Schema(example = "Vire à direita em direção a Rua da Ajuda") String texto,
            @Schema(description = "Distância até o próximo passo, em metros (0 nos avisos)", example = "30")
            long distanciaMetros) {
    }

    @Schema(description = "Rota sem desvio: só distância, tempo e linha")
    public record Resumo(
            @Schema(example = "558") long distanciaMetros,
            @Schema(example = "402") long duracaoSegundos,
            Geometria geometria) {

        static Resumo de(RotaOrs rota) {
            return new Resumo(Math.round(rota.distanciaMetros()), Math.round(rota.duracaoSegundos()),
                    new Geometria("LineString", rota.coordenadas()));
        }
    }
}
