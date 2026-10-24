package br.labai.rotas;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Libera o front (outro domínio) a chamar a API pelo navegador. */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> origens;

    public CorsConfig(@Value("${cors.origens}") List<String> origens) {
        this.origens = origens;
    }

    @Override
    public void addCorsMappings(CorsRegistry registro) {
        // POST só no /api/rota (obstáculos simulados); padrões aceitam "*" e curingas como https://*.exemplo.com
        String[] padroes = origens.stream().map(String::trim).filter(o -> !o.isEmpty()).toArray(String[]::new);
        registro.addMapping("/api/**").allowedOriginPatterns(padroes).allowedMethods("GET", "POST");
        registro.addMapping("/health").allowedOriginPatterns(padroes).allowedMethods("GET");
    }
}
