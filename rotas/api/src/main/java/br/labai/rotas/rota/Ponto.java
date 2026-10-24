package br.labai.rotas.rota;

import io.swagger.v3.oas.annotations.media.Schema;

/** Ponto recebido na API como "lat,lon". */
@Schema(description = "Ponto em graus decimais")
public record Ponto(
        @Schema(example = "-12.9737") double latitude,
        @Schema(example = "-38.5094") double longitude) {

    static Ponto ler(String texto, String nomeParametro) {
        String[] partes = texto == null ? new String[0] : texto.split(",");
        if (partes.length != 2) {
            throw new ParametroInvalidoException(nomeParametro + " deve estar no formato lat,lon (ex.: -12.9737,-38.5094)");
        }
        double lat, lon;
        try {
            lat = Double.parseDouble(partes[0].trim());
            lon = Double.parseDouble(partes[1].trim());
        } catch (NumberFormatException e) {
            throw new ParametroInvalidoException(nomeParametro + " deve ter números com ponto (ex.: -12.9737,-38.5094)");
        }
        return verificar(new Ponto(lat, lon), nomeParametro);
    }

    /** Para pontos que chegam no corpo JSON do POST. */
    static Ponto verificar(Ponto p, String nomeParametro) {
        if (p == null) {
            throw new ParametroInvalidoException("campo obrigatório: " + nomeParametro);
        }
        // isFinite: NaN passaria pelas comparações abaixo
        if (!Double.isFinite(p.latitude()) || !Double.isFinite(p.longitude())
                || p.latitude() < -90 || p.latitude() > 90 || p.longitude() < -180 || p.longitude() > 180) {
            throw new ParametroInvalidoException(nomeParametro + ": latitude deve estar entre -90 e 90 e longitude entre -180 e 180");
        }
        return p;
    }

    /** Formato do ORS e do GeoJSON: [longitude, latitude]. */
    double[] lonLat() {
        return new double[] {longitude, latitude};
    }
}
