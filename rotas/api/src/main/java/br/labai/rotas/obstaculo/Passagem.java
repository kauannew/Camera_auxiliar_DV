package br.labai.rotas.obstaculo;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import io.swagger.v3.oas.annotations.media.Schema;
import java.text.Normalizer;
import java.util.Locale;

/** Dá para passar pela calçada onde está o obstáculo? Informado pela câmera. */
@Schema(description = "bloqueada: sempre desvia. dificil: desvia se o desvio for curto. contornavel: só avisa")
public enum Passagem {

    /** Não passa: a rota sempre contorna. */
    BLOQUEADA,
    /** Passa com dificuldade: a rota contorna se o desvio não aumentar muito o caminho. */
    DIFICIL,
    /** Dá para contornar ali mesmo: a rota não desvia, só avisa. */
    CONTORNAVEL;

    /**
     * Converte o texto do JSON (bloqueada, dificil ou contornavel, com ou sem acento); se não vier, assume
     * bloqueada. Texto desconhecido lança IllegalArgumentException.
     */
    @JsonCreator
    public static Passagem de(String texto) {
        if (texto == null) {
            return BLOQUEADA;
        }
        String semAcento = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return valueOf(semAcento.toUpperCase(Locale.ROOT));
    }

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }
}
