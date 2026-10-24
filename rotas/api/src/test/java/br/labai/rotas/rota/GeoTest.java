package br.labai.rotas.rota;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class GeoTest {

    private static final double LAT = -12.9737, LON = -38.5094;

    @Test
    void quadradoTemLadoEmMetrosEFechaOAnel() {
        List<double[]> anel = Geo.quadrado(LAT, LON, 4);

        assertEquals(5, anel.size());
        assertArrayEquals(anel.get(0), anel.get(4));
        double larguraMetros = (anel.get(1)[0] - anel.get(0)[0]) * Geo.metrosPorGrauLon(LAT);
        double alturaMetros = (anel.get(2)[1] - anel.get(1)[1]) * Geo.METROS_POR_GRAU_LAT;
        assertEquals(4, larguraMetros, 0.001);
        assertEquals(4, alturaMetros, 0.001);
    }

    @Test
    void distanciaAteLinhaUsaOTrechoMaisProximo() {
        // Linha leste-oeste de ~100 m; ponto 10 m ao norte do meio dela
        double dLon = 50 / Geo.metrosPorGrauLon(LAT);
        List<double[]> linha = List.of(new double[] {LON - dLon, LAT}, new double[] {LON + dLon, LAT});
        double latNorte = LAT + 10 / Geo.METROS_POR_GRAU_LAT;

        assertEquals(10, Geo.distanciaAteLinha(latNorte, LON, linha), 0.01);
        // Além da ponta: distância até a ponta, não até a reta infinita
        assertEquals(50, Geo.distanciaAteLinha(LAT, LON + 2 * dLon, linha), 0.01);
    }

    @Test
    void posicaoNaLinhaMedeOsMetrosAteOPontoMaisProximo() {
        // Linha em L: 100 m para leste e 100 m para o norte; ponto 5 m ao lado do meio do segundo trecho
        double dLon = 100 / Geo.metrosPorGrauLon(LAT), dLat = 100 / Geo.METROS_POR_GRAU_LAT;
        List<double[]> linha = List.of(new double[] {LON, LAT}, new double[] {LON + dLon, LAT},
                new double[] {LON + dLon, LAT + dLat});
        double lonAoLado = LON + dLon + 5 / Geo.metrosPorGrauLon(LAT);

        assertEquals(150, Geo.posicaoNaLinha(LAT + dLat / 2, lonAoLado, linha), 0.1);
        assertEquals(100, Geo.comprimentoAte(linha, 1), 0.1);
        assertEquals(200, Geo.comprimentoAte(linha, 2), 0.1);
    }

    @Test
    void lerPontoNoFormatoLatLon() {
        Ponto p = Ponto.ler(" -12.9737 , -38.5094 ", "origem");
        assertArrayEquals(new double[] {-38.5094, -12.9737}, p.lonLat());
    }
}
