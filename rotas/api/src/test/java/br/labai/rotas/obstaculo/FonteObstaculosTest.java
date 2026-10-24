package br.labai.rotas.obstaculo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class FonteObstaculosTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final Map<String, Passagem> porClasse = FonteObstaculos.lerPorClasse("obstaculo_suspenso:bloqueada,buraco:dificil");

    @Test
    void descartaRegistrosRuinsSemDerrubarOsBons() {
        List<Obstaculo> lista = FonteObstaculos.converter(json.readTree("""
                [ null,
                  {"lat": "x", "lng": -38.51},
                  {"latitude": "x", "longitude": -38.51},
                  {"latitude": 95, "longitude": -38.51},
                  {"id": 7, "latitude": -12.97, "longitude": -38.51, "passagem": "dificil", "registradoEm": "2026-10-22T14:30:00Z"} ]
                """), porClasse);
        assertEquals(1, lista.size());
        assertEquals(Passagem.DIFICIL, lista.get(0).passagem());
    }

    @Test
    void passagemDesconhecidaViraBloqueada() {
        List<Obstaculo> lista = FonteObstaculos.converter(json.readTree("""
                [{"latitude": -12.97, "longitude": -38.51, "passagem": "talvez"}]
                """), porClasse);
        assertEquals(Passagem.BLOQUEADA, lista.get(0).passagem());
    }

    @Test
    void camposOpcionaisAusentes() {
        Obstaculo o = FonteObstaculos.converter(json.readTree("""
                [{"latitude": -12.97, "longitude": -38.51}]
                """), porClasse).get(0);
        assertEquals(Passagem.BLOQUEADA, o.passagem());
        assertEquals("obstáculo", o.tipo());
        assertNull(o.confianca());
    }

    @Test
    void formatoDoBackDaCamera() {
        List<Obstaculo> lista = FonteObstaculos.converter(json.readTree("""
                [ {"id": "a", "classe": "buraco", "lat": -12.97, "lng": -38.51, "confirmacoes": 3, "confianca_media": 0.8},
                  {"id": "b", "classe": "obstaculo_suspenso", "lat": -12.96, "lng": -38.50, "confirmacoes": 1, "confianca_media": 0.7},
                  {"id": "c", "classe": "poste", "lat": -12.95, "lng": -38.49, "confirmacoes": 1, "confianca_media": 0.9} ]
                """), porClasse);
        assertEquals(3, lista.size());
        Obstaculo buraco = lista.get(0);
        assertEquals(-12.97, buraco.latitude());
        assertEquals(-38.51, buraco.longitude());
        assertEquals(Passagem.DIFICIL, buraco.passagem());
        assertEquals("buraco", buraco.tipo());
        assertEquals(0.8, buraco.confianca());
        assertEquals(Passagem.BLOQUEADA, lista.get(1).passagem());
        assertEquals("obstáculo suspenso", lista.get(1).tipo());
        // Classe fora do mapeamento: bloqueada, por segurança
        assertEquals(Passagem.BLOQUEADA, lista.get(2).passagem());
    }

    @Test
    void passagemExplicitaVenceAClasse() {
        Obstaculo o = FonteObstaculos.converter(json.readTree("""
                [{"classe": "buraco", "lat": -12.97, "lng": -38.51, "passagem": "contornavel"}]
                """), porClasse).get(0);
        assertEquals(Passagem.CONTORNAVEL, o.passagem());
    }

    @Test
    void mapeamentoPorClasse() {
        assertEquals(Map.of("buraco", Passagem.DIFICIL), FonteObstaculos.lerPorClasse(" Buraco : difícil ,"));
        assertEquals(Map.of(), FonteObstaculos.lerPorClasse(""));
        assertThrows(IllegalArgumentException.class, () -> FonteObstaculos.lerPorClasse("buraco"));
        assertThrows(IllegalArgumentException.class, () -> FonteObstaculos.lerPorClasse("buraco:talvez"));
    }
}
