package br.labai.rotas.ors;

import br.labai.rotas.rota.AreaAtendida;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class OrsConfig {

    /**
     * Motores na ordem de preferência: o ORS próprio (se configurado) vem antes, porque não tem cota;
     * o OrsClient só usa cada um onde ele cobre.
     */
    @Bean
    List<MotorOrs> motoresOrs(@Value("${ors.url}") String urlPublica,
                              @Value("${ors.chave:}") String chave,
                              @Value("${ors.local.url:}") String urlLocal,
                              @Value("${ors.local.nome:salvador}") String nomeLocal,
                              @Value("${ors.local.bbox}") String bboxLocal) {
        List<MotorOrs> motores = new ArrayList<>();
        if (!urlLocal.isBlank()) {
            motores.add(new MotorOrs(nomeLocal, cliente(urlLocal.trim(), ""), AreaAtendida.ler(bboxLocal)));
        }
        motores.add(new MotorOrs("publico", cliente(urlPublica, chave), null));
        return motores;
    }

    private static RestClient cliente(String url, String chave) {
        var tempos = new SimpleClientHttpRequestFactory();
        tempos.setConnectTimeout(Duration.ofSeconds(3));
        tempos.setReadTimeout(Duration.ofSeconds(15));
        var builder = RestClient.builder().baseUrl(url).requestFactory(tempos);
        // A API pública exige a chave; um ORS próprio não precisa dela
        if (!chave.isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, chave.trim());
        }
        return builder.build();
    }
}
