package br.labai.rotas.ors;

/** Erro devolvido pelo ORS (ex.: 2009 rota não encontrada, 2010 ponto fora do mapa). */
public class OrsException extends RuntimeException {

    public static final int LIMITE_EXCEDIDO = 2004;
    public static final int ROTA_NAO_ENCONTRADA = 2009;
    public static final int PONTO_NAO_ENCONTRADO = 2010;
    /** Status HTTP da API pública (não é código do ORS): cota por minuto ou por dia esgotada. */
    public static final int COTA_ESGOTADA = 429;
    /** Status HTTP da API pública (não é código do ORS): ORS_API_KEY ausente ou inválida. */
    public static final int CHAVE_INVALIDA = 403;

    private final int codigo;
    private final boolean indisponivel;

    public OrsException(int codigo, String mensagem) {
        this(codigo, mensagem, codigo == COTA_ESGOTADA || codigo == CHAVE_INVALIDA);
    }

    /** @param indisponivel o motor não atendeu (cota, chave, erro do servidor): vale tentar outro motor */
    public OrsException(int codigo, String mensagem, boolean indisponivel) {
        super(mensagem);
        this.codigo = codigo;
        this.indisponivel = indisponivel;
    }

    public int getCodigo() {
        return codigo;
    }

    public boolean isIndisponivel() {
        return indisponivel;
    }
}
