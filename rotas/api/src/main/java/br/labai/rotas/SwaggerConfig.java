package br.labai.rotas;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.tags.Tag;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    public static final String TAG_ROTAS = "Rotas";
    public static final String TAG_OBSTACULOS = "Obstáculos";
    public static final String TAG_STATUS = "Status";

    @Bean
    OpenAPI documentacao() {
        return new OpenAPI()
                .info(new Info()
                        .title("API de rotas acessíveis")
                        .version("1.0.0")
                        .description(DESCRICAO))
                .tags(List.of(
                        new Tag().name(TAG_ROTAS).description("Calcular rotas"),
                        new Tag().name(TAG_OBSTACULOS).description("Ver os obstáculos registrados pela câmera"),
                        new Tag().name(TAG_STATUS).description("Ver se está tudo funcionando e qual área é atendida")));
    }

    private static final String DESCRICAO = """
            Calcula rotas a pé para pessoas com deficiência visual (ou de cadeira de rodas, com `perfil=wheelchair`), \
            desviando dos obstáculos que a câmera da equipe registrou nas calçadas.

            **Para o front, basta um endpoint:** `GET /api/rota?origem=lat,lon&destino=lat,lon`. \
            Ele devolve a linha da rota para desenhar no mapa e as instruções em texto.

            **[Abrir a página de teste com mapa](/)**

            ### Endpoints

            | Endpoint | Para que serve | Quem usa |
            |---|---|---|
            | `GET /api/rota` | Calcular a rota | o front |
            | `POST /api/rota` | Calcular a rota com obstáculos inventados | testes e demonstração |
            | `GET /api/obstaculos` | Listar os obstáculos de uma área | o front, para mostrar no mapa |
            | `GET /api/area` | Ver onde a API calcula rotas | o front, para limitar o mapa |
            | `GET /health` | Ver se está tudo funcionando | a equipe |

            ### De onde vêm os obstáculos

            Nenhum endpoint recebe dados da câmera: **é a API que busca**. A cada rota, ela consulta o \
            endereço da câmera (configurado no servidor) e pega os obstáculos da área. Nada é gravado aqui.

            Cada obstáculo tem um nível de passagem:

            | Nível | O que a rota faz |
            |---|---|
            | `bloqueada` | Sempre desvia. Se não houver outro caminho, avisa que não existe rota acessível. |
            | `dificil` | Desvia se o desvio for curto (até 30% ou 100 m a mais); senão passa e avisa. |
            | `contornavel` | Não desvia, só avisa. |

            ### Quem calcula a rota

            | Motor | Onde | Limite |
            |---|---|---|
            | `salvador` | Servidor próprio com o mapa de Salvador | Sem limite: dá para testar com mais carga, sem exageros |
            | `publico` | API pública do openrouteservice, no mundo todo | 2.000 rotas por dia e 40 por minuto |

            Dentro de Salvador a API usa o `salvador`; fora, o `publico`. Se um cair, o outro assume onde puder. \
            O campo `motor` da resposta diz quem calculou.

            ### Erros

            Todo erro vem como `{ "erro": "mensagem" }`.

            | Status | Quando |
            |---|---|
            | 400 | Coordenada em formato errado, fora da área atendida ou JSON inválido |
            | 422 | Não existe caminho com esse perfil (acontece com cadeira onde o mapa não tem dados de calçada) |
            | 503 | Câmera fora do ar, motor de rotas fora do ar ou limite de pedidos atingido |

            Coordenadas em graus decimais com ponto. Na URL o formato é `lat,lon`; na linha da rota (GeoJSON) \
            cada ponto vem como `[longitude, latitude]`, como manda o padrão.""";
}
