package br.labai.rotas.rota;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AreaAtendidaTest {

    private final AreaAtendida pelourinho = new AreaAtendida("-38.5160,-12.9830,-38.5010,-12.9640", "Pelourinho");
    private final AreaAtendida duas = new AreaAtendida(
            "-38.6995,-13.0174,-38.3034,-12.7336; -35.0200,-8.1600,-34.8600,-7.9300", "Salvador;Recife");

    private final Ponto terreiro = new Ponto(-12.9737, -38.5094);
    private final Ponto boaVista = new Ponto(-8.0601, -34.8883);

    @Test
    void aceitaPontoDentro() {
        assertDoesNotThrow(() -> pelourinho.validar(terreiro, new Ponto(-12.9732, -38.5119)));
    }

    @Test
    void recusaPontoForaComNomeDaArea() {
        var erro = assertThrows(ParametroInvalidoException.class,
                () -> pelourinho.validar(terreiro, new Ponto(-12.9000, -38.5094)));
        assertEquals("destino fora da área atendida (Pelourinho).", erro.getMessage());
    }

    @Test
    void semBboxNaoValida() {
        assertDoesNotThrow(() -> new AreaAtendida("", "").validar(new Ponto(-23.5, -46.6), terreiro));
    }

    @Test
    void recusaBboxInvertido() {
        assertThrows(IllegalArgumentException.class, () -> AreaAtendida.ler("-38.50,-12.98,-38.51,-12.96"));
    }

    @Test
    void variasAreas() {
        assertEquals(2, duas.areas().size());
        assertEquals("Salvador, Recife", duas.nome());
        assertDoesNotThrow(() -> duas.validar(terreiro, new Ponto(-12.9732, -38.5119)));
        assertDoesNotThrow(() -> duas.validar(boaVista, new Ponto(-8.0631, -34.8711)));
        var fora = assertThrows(ParametroInvalidoException.class, () -> duas.validar(new Ponto(-23.5, -46.6), terreiro));
        assertEquals("origem fora da área atendida (Salvador, Recife).", fora.getMessage());
        var misturadas = assertThrows(ParametroInvalidoException.class, () -> duas.validar(terreiro, boaVista));
        assertTrue(misturadas.getMessage().startsWith("origem e destino precisam estar na mesma área"));
    }
}
