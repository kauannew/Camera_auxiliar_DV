package br.labai.rotas.rota;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Retângulos onde a API calcula rotas. AREA_BBOX tem um ou mais, separados por ";", e AREA_NOME os nomes
 * na mesma ordem. AREA_BBOX vazio desliga a checagem (mundo todo).
 */
@Component
public class AreaAtendida {

    /** Uma área: nome e minLon,minLat,maxLon,maxLat. */
    public record Area(String nome, double[] bbox) {

        boolean contem(Ponto p) {
            return p.longitude() >= bbox[0] && p.latitude() >= bbox[1]
                    && p.longitude() <= bbox[2] && p.latitude() <= bbox[3];
        }
    }

    private final List<Area> areas;

    public AreaAtendida(@Value("${area.bbox:}") String bbox, @Value("${area.nome:}") String nome) {
        List<Area> lidas = new ArrayList<>();
        if (!bbox.isBlank()) {
            String[] caixas = bbox.split(";");
            String[] nomes = nome.split(";");
            for (int i = 0; i < caixas.length; i++) {
                lidas.add(new Area(i < nomes.length ? nomes[i].trim() : "", ler(caixas[i])));
            }
        }
        this.areas = List.copyOf(lidas);
    }

    /** minLon,minLat,maxLon,maxLat, como no GeoJSON e no CIDADE_BBOX. */
    public static double[] ler(String texto) {
        String[] partes = texto.split(",");
        if (partes.length != 4) {
            throw new IllegalArgumentException("AREA_BBOX deve ser minLon,minLat,maxLon,maxLat: " + texto);
        }
        double[] b = new double[4];
        for (int i = 0; i < 4; i++) {
            b[i] = Double.parseDouble(partes[i].trim());
        }
        if (b[0] >= b[2] || b[1] >= b[3]) {
            throw new IllegalArgumentException("AREA_BBOX com mínimo maior que máximo: " + texto);
        }
        return b;
    }

    /** As áreas atendidas; vazia quando é o mundo todo. */
    public List<Area> areas() {
        return areas;
    }

    /** Nomes das áreas, juntos ("Salvador, Recife"). */
    public String nome() {
        return String.join(", ", areas.stream().map(Area::nome).filter(n -> !n.isBlank()).toList());
    }

    /** minLon,minLat,maxLon,maxLat da primeira área, ou null se a checagem estiver desligada. */
    public double[] bbox() {
        return areas.isEmpty() ? null : areas.get(0).bbox().clone();
    }

    /** Origem e destino têm de estar dentro de uma mesma área. */
    void validar(Ponto origem, Ponto destino) {
        if (areas.isEmpty()) {
            return;
        }
        Area daOrigem = onde(origem, "origem");
        Area doDestino = onde(destino, "destino");
        if (daOrigem != doDestino) {
            throw new ParametroInvalidoException("origem e destino precisam estar na mesma área atendida (origem em "
                    + daOrigem.nome() + ", destino em " + doDestino.nome() + ").");
        }
    }

    private Area onde(Ponto p, String nomeParametro) {
        return areas.stream().filter(a -> a.contem(p)).findFirst()
                .orElseThrow(() -> new ParametroInvalidoException(nomeParametro + " fora da área atendida"
                        + (nome().isBlank() ? "" : " (" + nome() + ")") + "."));
    }
}
