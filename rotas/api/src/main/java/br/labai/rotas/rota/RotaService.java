package br.labai.rotas.rota;

import br.labai.rotas.obstaculo.Obstaculo;
import br.labai.rotas.obstaculo.FonteObstaculos;
import br.labai.rotas.obstaculo.Passagem;
import br.labai.rotas.ors.OrsClient;
import br.labai.rotas.ors.OrsException;
import br.labai.rotas.ors.RotaOrs;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 1. Pede a rota direta ao ORS.
 * 2. Vê quais obstáculos (confiança mínima) ficam em cima dela.
 * 3. Se houver algum, pede de novo evitando os quadrados (avoid_polygons):
 *    - passagem bloqueada: sempre. Sem desvio (ou se ele sair ou chegar em outro lugar),
 *      devolve a rota direta com desvioPossivel = false.
 *    - passagem difícil: só se o desvio aumentar a rota em até desvioPercentual, ou em até desvioPiso metros.
 *    - passagem contornável: nunca; só aviso.
 * 4. Obstáculo difícil ou contornável que ficou na rota vira um aviso nas instruções.
 */
@Service
public class RotaService {

    private static final Logger log = LoggerFactory.getLogger(RotaService.class);

    /** Correções em instruções do ORS em português. */
    private static final Map<String, String> CORRECOES = Map.of("nordoeste", "noroeste");

    /** Quantas vezes o desvio é refeito ao descobrir bloqueios fora da janela de busca (cada vez gasta cota). */
    private static final int MAXIMO_RODADAS_DESVIO = 3;

    private final OrsClient ors;
    private final FonteObstaculos obstaculos;
    private final double confiancaMinima;
    private final double ladoQuadrado;
    private final double margemBusca;
    private final double toleranciaPonta;
    private final double desvioPercentual;
    private final double desvioPiso;

    public RotaService(OrsClient ors, FonteObstaculos obstaculos,
                       @Value("${rota.confianca-minima}") double confiancaMinima,
                       @Value("${rota.lado-quadrado-metros}") double ladoQuadrado,
                       @Value("${rota.margem-busca-metros}") double margemBusca,
                       @Value("${rota.tolerancia-ponta-metros}") double toleranciaPonta,
                       @Value("${rota.desvio-percentual}") double desvioPercentual,
                       @Value("${rota.desvio-piso-metros}") double desvioPiso) {
        this.ors = ors;
        this.obstaculos = obstaculos;
        this.confiancaMinima = confiancaMinima;
        this.ladoQuadrado = ladoQuadrado;
        this.margemBusca = margemBusca;
        this.toleranciaPonta = toleranciaPonta;
        this.desvioPercentual = desvioPercentual;
        this.desvioPiso = desvioPiso;
    }

    /**
     * @param extras obstáculos simulados (página de teste), somados aos da câmera; nada é guardado
     * @param incluirRotaSemDesvio devolve também a rota direta, que já é calculada de qualquer jeito
     *                             (evita um segundo pedido só para comparar)
     */
    public RotaResposta calcular(Ponto origem, Ponto destino, String perfil, boolean considerarObstaculos,
                                 List<Obstaculo> extras, boolean incluirRotaSemDesvio) {
        RotaOrs direta = ors.rota(perfil, origem.lonLat(), destino.lonLat(), List.of());
        RotaResposta resposta = considerarObstaculos
                ? desviandoDosObstaculos(origem, destino, perfil, extras, direta)
                : resposta(direta, 0, true, List.of());
        return incluirRotaSemDesvio ? resposta.comRotaSemDesvio(RotaResposta.Resumo.de(direta)) : resposta;
    }

    private RotaResposta desviandoDosObstaculos(Ponto origem, Ponto destino, String perfil, List<Obstaculo> extras,
                                                RotaOrs direta) {

        // Mutável: o desvio pode revelar bloqueios além da janela de busca, que entram aqui
        List<Obstaculo> proximos = new ArrayList<>(obstaculosPerto(direta.coordenadas(), extras, margemBusca));
        List<Obstaculo> noCaminho = proximos.stream().filter(o -> passaPor(direta, o)).toList();

        // Bloqueada: sempre contorna. Se não houver desvio, devolve a direta com desvioPossivel = false
        RotaOrs rota = direta;
        if (noCaminho.stream().anyMatch(o -> o.passagem() == Passagem.BLOQUEADA)) {
            rota = desviar(perfil, origem, destino, List.of(), proximos, extras, direta);
            if (rota == null) {
                return resposta(direta, 0, false, proximos);
            }
        }

        // Difícil: contorna se o desvio aumentar a rota em até desvioPercentual (ou até desvioPiso metros,
        // para rotas curtas); senão passa por ela com aviso
        RotaOrs semDificeis = rota;
        if (proximos.stream().anyMatch(o -> o.passagem() == Passagem.DIFICIL && passaPor(semDificeis, o))) {
            RotaOrs desvio = desviar(perfil, origem, destino, quadrados(proximos, Passagem.DIFICIL), proximos, extras, direta);
            double limite = Math.max(desvioPiso, rota.distanciaMetros() * desvioPercentual / 100);
            if (desvio != null && desvio.distanciaMetros() - rota.distanciaMetros() <= limite) {
                rota = desvio;
            } else if (desvio != null) {
                log.info("Desvio da passagem difícil recusado: {} m a mais (limite {} m)",
                        Math.round(desvio.distanciaMetros() - rota.distanciaMetros()), Math.round(limite));
            }
        }

        // Contornável nunca desvia: só gera aviso. Conta como evitado o que saiu do caminho
        RotaOrs escolhida = rota;
        int evitados = (int) noCaminho.stream().filter(o -> !passaPor(escolhida, o)).count();
        return resposta(escolhida, evitados, true, proximos);
    }

    /**
     * Pede a rota evitando todos os bloqueados conhecidos mais os quadrados extras. Se o desvio passar por um
     * bloqueado que estava fora da janela de busca, ele entra em conhecidos e o pedido é refeito.
     * Null se o ORS não achar, se a rota sair ou chegar longe do ponto pedido ou se não fugir dos bloqueios.
     */
    private RotaOrs desviar(String perfil, Ponto origem, Ponto destino, List<List<double[]>> extrasEvitar,
                            List<Obstaculo> conhecidos, List<Obstaculo> simulados, RotaOrs direta) {
        for (int rodada = 1; rodada <= MAXIMO_RODADAS_DESVIO; rodada++) {
            List<List<double[]>> evitar = new ArrayList<>(quadrados(conhecidos, Passagem.BLOQUEADA));
            evitar.addAll(extrasEvitar);
            RotaOrs desvio;
            try {
                desvio = ors.rota(perfil, origem.lonLat(), destino.lonLat(), evitar);
            } catch (OrsException e) {
                // Só "não achou caminho" significa sem desvio; cota esgotada, chave inválida etc. sobem como erro
                if (e.getCodigo() != OrsException.ROTA_NAO_ENCONTRADA && e.getCodigo() != OrsException.PONTO_NAO_ENCONTRADO) {
                    throw e;
                }
                log.info("Sem desvio possível ({} quadrados evitados): ORS {} {}", evitar.size(), e.getCodigo(), e.getMessage());
                return null;
            }
            // Se o trecho da chegada (ou da saída) está bloqueado, o ORS encaixa o ponto em
            // outro caminho próximo e a rota termina em outro lugar: isso não conta como desvio
            if (afastou(desvio, direta, origem, 0) || afastou(desvio, direta, destino, -1)) {
                log.info("Sem desvio possível ({} quadrados evitados): o desvio sai ou chega longe do ponto pedido", evitar.size());
                return null;
            }
            List<Obstaculo> novos = obstaculosPerto(desvio.coordenadas(), simulados, ladoQuadrado).stream()
                    .filter(o -> o.passagem() == Passagem.BLOQUEADA && !conhecidos.contains(o) && passaPor(desvio, o))
                    .toList();
            if (novos.isEmpty()) {
                return desvio;
            }
            log.info("O desvio passa por {} bloqueio(s) fora da janela de busca; refazendo", novos.size());
            conhecidos.addAll(novos);
        }
        log.info("Sem desvio possível: depois de {} tentativas o desvio ainda passa por bloqueios", MAXIMO_RODADAS_DESVIO);
        return null;
    }

    private List<List<double[]>> quadrados(List<Obstaculo> obstaculos, Passagem passagem) {
        return obstaculos.stream()
                .filter(o -> o.passagem() == passagem)
                .map(o -> Geo.quadrado(o.latitude(), o.longitude(), ladoQuadrado))
                .toList();
    }

    /** O obstáculo está perto o bastante da linha para o quadrado dele encostar na rota? */
    private boolean passaPor(RotaOrs rota, Obstaculo o) {
        // Um ponto a até meia diagonal do centro pode cair dentro do quadrado
        double raio = ladoQuadrado / 2 * Math.sqrt(2);
        return Geo.distanciaAteLinha(o.latitude(), o.longitude(), rota.coordenadas()) <= raio;
    }

    /** O ponto da rota com desvio ficou mais longe do pedido do que o da rota direta, além da tolerância? */
    private boolean afastou(RotaOrs desvio, RotaOrs direta, Ponto pedido, int indice) {
        return distanciaAte(desvio, pedido, indice) > distanciaAte(direta, pedido, indice) + toleranciaPonta;
    }

    private static double distanciaAte(RotaOrs rota, Ponto pedido, int indice) {
        List<double[]> c = rota.coordenadas();
        double[] ponta = c.get(indice < 0 ? c.size() - 1 : indice);
        return Geo.distanciaAteLinha(pedido.latitude(), pedido.longitude(), List.of(ponta));
    }

    /** Obstáculos confiáveis dentro do retângulo da linha, com margem (metros) para cada lado. */
    private List<Obstaculo> obstaculosPerto(List<double[]> linha, List<Obstaculo> extras, double margemBusca) {
        double minLon = Double.MAX_VALUE, maxLon = -Double.MAX_VALUE;
        double minLat = Double.MAX_VALUE, maxLat = -Double.MAX_VALUE;
        for (double[] c : linha) {
            minLon = Math.min(minLon, c[0]);
            maxLon = Math.max(maxLon, c[0]);
            minLat = Math.min(minLat, c[1]);
            maxLat = Math.max(maxLat, c[1]);
        }
        double dLat = margemBusca / Geo.METROS_POR_GRAU_LAT;
        double dLon = margemBusca / Geo.metrosPorGrauLon((minLat + maxLat) / 2);
        double oeste = minLon - dLon, sul = minLat - dLat, leste = maxLon + dLon, norte = maxLat + dLat;
        List<Obstaculo> todos = new ArrayList<>(obstaculos.dentro(oeste, sul, leste, norte));
        extras.stream()
                .filter(o -> o.latitude() >= sul && o.latitude() <= norte && o.longitude() >= oeste && o.longitude() <= leste)
                .forEach(todos::add);
        // Confiança é opcional: se a câmera não mandar, o obstáculo vale
        return todos.stream()
                .filter(o -> o.confianca() == null || o.confianca() >= confiancaMinima)
                .toList();
    }

    private RotaResposta resposta(RotaOrs rota, int evitados, boolean desvioPossivel, List<Obstaculo> proximos) {
        List<double[]> linha = rota.coordenadas();
        // Obstáculos que ficaram no caminho, com a posição (metros desde o início da rota). Bloqueados só
        // entram sem desvio possível: com desvio, um quadrado contornado ainda pode cair no raio de passaPor
        Map<Obstaculo, Double> avisos = new LinkedHashMap<>();
        proximos.stream()
                .filter(o -> (o.passagem() != Passagem.BLOQUEADA || !desvioPossivel) && passaPor(rota, o))
                .sorted(Comparator.comparingDouble(o -> Geo.posicaoNaLinha(o.latitude(), o.longitude(), linha)))
                .forEach(o -> avisos.put(o, Geo.posicaoNaLinha(o.latitude(), o.longitude(), linha)));

        List<RotaResposta.Instrucao> instrucoes = new ArrayList<>();
        List<RotaOrs.Passo> passos = rota.passos();
        for (int i = 0; i < passos.size(); i++) {
            RotaOrs.Passo p = passos.get(i);
            instrucoes.add(new RotaResposta.Instrucao(corrigir(p.instrucao()), Math.round(p.distanciaMetros())));
            // O aviso vem logo depois da instrução do passo em que o obstáculo está
            double inicio = Geo.comprimentoAte(linha, p.inicio());
            double fim = i + 1 < passos.size() ? Geo.comprimentoAte(linha, passos.get(i + 1).inicio()) : Double.MAX_VALUE;
            avisos.forEach((o, posicao) -> {
                if (posicao >= inicio && posicao < fim) {
                    instrucoes.add(new RotaResposta.Instrucao(aviso(o, posicao - inicio), 0));
                }
            });
        }
        return new RotaResposta(
                Math.round(rota.distanciaMetros()),
                Math.round(rota.duracaoSegundos()),
                new RotaResposta.Geometria("LineString", linha),
                instrucoes,
                evitados,
                desvioPossivel,
                rota.motor(),
                null);
    }

    private static String aviso(Obstaculo o, double metros) {
        long arredondado = Math.round(metros / 5) * 5;
        String onde = arredondado < 5 ? "logo à frente" : "em cerca de " + arredondado + " metros";
        String como = switch (o.passagem()) {
            case CONTORNAVEL -> "Dá para contornar.";
            case DIFICIL -> "Passagem difícil, sem desvio próximo.";
            case BLOQUEADA -> "Passagem bloqueada, sem desvio possível.";
        };
        return "Atenção: " + o.tipo() + " " + onde + ". " + como;
    }

    private static String corrigir(String texto) {
        for (var c : CORRECOES.entrySet()) {
            texto = texto.replace(c.getKey(), c.getValue());
        }
        return texto;
    }
}
