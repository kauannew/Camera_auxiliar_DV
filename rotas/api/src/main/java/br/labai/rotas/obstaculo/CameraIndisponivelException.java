package br.labai.rotas.obstaculo;

/** O back da câmera não respondeu, ou respondeu num formato que a API não entende. */
public class CameraIndisponivelException extends RuntimeException {

    public CameraIndisponivelException(String mensagem) {
        super(mensagem);
    }
}
