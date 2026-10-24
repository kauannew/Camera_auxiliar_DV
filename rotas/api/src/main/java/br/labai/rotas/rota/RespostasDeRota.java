package br.labai.rotas.rota;

import br.labai.rotas.ExemplosApi;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Respostas documentadas no Swagger, iguais no GET e no POST de /api/rota. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@ApiResponses({
        @ApiResponse(responseCode = "200", description = "Rota calculada", content = @Content(
                mediaType = "application/json",
                schema = @Schema(implementation = RotaResposta.class),
                examples = {
                        @ExampleObject(name = "Desviou de um bloqueio", value = ExemplosApi.ROTA_COM_DESVIO),
                        @ExampleObject(name = "Obstáculo contornável: só aviso", value = ExemplosApi.ROTA_COM_AVISO),
                        @ExampleObject(name = "Sem desvio possível", value = ExemplosApi.ROTA_SEM_DESVIO_POSSIVEL)})),
        @ApiResponse(responseCode = "400", description = "Parâmetro inválido ou fora da área atendida", content = @Content(
                mediaType = "application/json",
                examples = {
                        @ExampleObject(name = "Fora da área", value = ExemplosApi.ERRO_FORA_DA_AREA),
                        @ExampleObject(name = "Formato errado", value = ExemplosApi.ERRO_FORMATO)})),
        @ApiResponse(responseCode = "422", description = "Não existe caminho com esse perfil", content = @Content(
                mediaType = "application/json",
                examples = @ExampleObject(name = "Sem caminho", value = ExemplosApi.ERRO_SEM_CAMINHO))),
        @ApiResponse(responseCode = "503", description = "Câmera ou openrouteservice indisponível, ou limite de pedidos atingido",
                content = @Content(mediaType = "application/json", examples = {
                        @ExampleObject(name = "Câmera fora do ar", value = ExemplosApi.ERRO_CAMERA),
                        @ExampleObject(name = "Limite de pedidos", value = ExemplosApi.ERRO_COTA)}))
})
@interface RespostasDeRota {
}
