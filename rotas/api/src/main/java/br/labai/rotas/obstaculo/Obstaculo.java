package br.labai.rotas.obstaculo;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Obstáculo como vem do back da câmera. Só latitude, longitude e passagem importam para a rota;
 * tipo entra no texto do aviso e confianca, se vier, filtra detecções duvidosas.
 */
public record Obstaculo(
        @Schema(example = "-12.973495", requiredMode = Schema.RequiredMode.REQUIRED) double latitude,
        @Schema(example = "-38.511139", requiredMode = Schema.RequiredMode.REQUIRED) double longitude,
        @Schema(description = "Sem valor vale bloqueada", example = "bloqueada") Passagem passagem,
        @Schema(description = "Entra no texto do aviso; sem valor vira \"obstáculo\"", example = "degrau") String tipo,
        @Schema(description = "0 a 1. Abaixo de 0.6 o obstáculo é ignorado; sem valor, vale", example = "0.87") Double confianca) {

    public Obstaculo {
        // Sem passagem informada, o mais seguro é tratar como bloqueada
        passagem = passagem != null ? passagem : Passagem.BLOQUEADA;
        tipo = tipo != null && !tipo.isBlank() ? tipo : "obstáculo";
    }
}
