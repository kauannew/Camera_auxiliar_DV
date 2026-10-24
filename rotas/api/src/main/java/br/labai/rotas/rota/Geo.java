package br.labai.rotas.rota;

import java.util.List;

/**
 * Contas geométricas simples para distâncias curtas (alguns km), usando uma
 * projeção plana local. Coordenadas no padrão GeoJSON: [longitude, latitude].
 */
final class Geo {

    static final double METROS_POR_GRAU_LAT = 111_320;

    private Geo() {
    }

    static double metrosPorGrauLon(double latitude) {
        return METROS_POR_GRAU_LAT * Math.cos(Math.toRadians(latitude));
    }

    /** Anel fechado de um quadrado com o lado em metros, centrado no ponto. */
    static List<double[]> quadrado(double latitude, double longitude, double ladoMetros) {
        double dLat = ladoMetros / 2 / METROS_POR_GRAU_LAT;
        double dLon = ladoMetros / 2 / metrosPorGrauLon(latitude);
        return List.of(
                new double[] {longitude - dLon, latitude - dLat},
                new double[] {longitude + dLon, latitude - dLat},
                new double[] {longitude + dLon, latitude + dLat},
                new double[] {longitude - dLon, latitude + dLat},
                new double[] {longitude - dLon, latitude - dLat});
    }

    /** Menor distância em metros entre o ponto e a linha (lista de [lon, lat]). */
    static double distanciaAteLinha(double latitude, double longitude, List<double[]> linha) {
        double mLon = metrosPorGrauLon(latitude);
        double menor = Double.MAX_VALUE;
        for (int i = 0; i < linha.size(); i++) {
            double[] a = linha.get(i);
            double[] b = linha.get(Math.min(i + 1, linha.size() - 1));
            // Projeta em metros com o ponto como origem
            double ax = (a[0] - longitude) * mLon, ay = (a[1] - latitude) * METROS_POR_GRAU_LAT;
            double bx = (b[0] - longitude) * mLon, by = (b[1] - latitude) * METROS_POR_GRAU_LAT;
            double dx = bx - ax, dy = by - ay;
            double comprimento2 = dx * dx + dy * dy;
            double t = comprimento2 == 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimento2));
            menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy));
        }
        return menor;
    }

    /** Metros percorridos na linha, desde o começo, até o ponto dela mais perto do ponto dado. */
    static double posicaoNaLinha(double latitude, double longitude, List<double[]> linha) {
        double mLon = metrosPorGrauLon(latitude);
        double menor = Double.MAX_VALUE, posicao = 0, percorrido = 0;
        for (int i = 0; i + 1 < linha.size(); i++) {
            double[] a = linha.get(i), b = linha.get(i + 1);
            double ax = (a[0] - longitude) * mLon, ay = (a[1] - latitude) * METROS_POR_GRAU_LAT;
            double bx = (b[0] - longitude) * mLon, by = (b[1] - latitude) * METROS_POR_GRAU_LAT;
            double dx = bx - ax, dy = by - ay;
            double comprimento2 = dx * dx + dy * dy;
            double t = comprimento2 == 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimento2));
            double distancia = Math.hypot(ax + t * dx, ay + t * dy);
            double trecho = Math.sqrt(comprimento2);
            if (distancia < menor) {
                menor = distancia;
                posicao = percorrido + t * trecho;
            }
            percorrido += trecho;
        }
        return posicao;
    }

    /** Metros percorridos na linha do começo até o ponto de índice dado. */
    static double comprimentoAte(List<double[]> linha, int indice) {
        double total = 0;
        for (int i = 0; i < indice && i + 1 < linha.size(); i++) {
            double[] a = linha.get(i), b = linha.get(i + 1);
            total += Math.hypot((b[0] - a[0]) * metrosPorGrauLon(a[1]), (b[1] - a[1]) * METROS_POR_GRAU_LAT);
        }
        return total;
    }
}
