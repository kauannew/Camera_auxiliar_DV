package br.labai.rotas.ors;

import org.springframework.web.client.RestClient;

/**
 * Um servidor do openrouteservice. A API pública cobre o mundo (bbox nulo); o ORS próprio só cobre o
 * mapa carregado nele (ex.: Salvador).
 *
 * @param bbox minLon,minLat,maxLon,maxLat da cobertura, ou null para o mundo todo
 */
public record MotorOrs(String nome, RestClient cliente, double[] bbox) {

    /** Origem e destino em [lon, lat] estão dentro da cobertura? */
    public boolean cobre(double[] origem, double[] destino) {
        return bbox == null || (dentro(origem) && dentro(destino));
    }

    private boolean dentro(double[] p) {
        return p[0] >= bbox[0] && p[0] <= bbox[2] && p[1] >= bbox[1] && p[1] <= bbox[3];
    }
}
