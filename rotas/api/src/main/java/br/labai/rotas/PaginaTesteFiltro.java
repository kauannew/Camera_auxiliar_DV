package br.labai.rotas;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Com PAGINA_TESTE=false a página de teste (index.html) some; a API e o Swagger continuam. */
@Component
public class PaginaTesteFiltro extends OncePerRequestFilter {

    private static final Set<String> CAMINHOS = Set.of("/", "/index.html");

    private final boolean ativa;

    public PaginaTesteFiltro(@Value("${pagina.teste:true}") boolean ativa) {
        this.ativa = ativa;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest pedido) {
        return ativa || !CAMINHOS.contains(pedido.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest pedido, HttpServletResponse resposta, FilterChain cadeia)
            throws ServletException, IOException {
        resposta.sendError(HttpStatus.NOT_FOUND.value());
    }
}
