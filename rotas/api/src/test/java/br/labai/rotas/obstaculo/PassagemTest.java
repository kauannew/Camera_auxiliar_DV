package br.labai.rotas.obstaculo;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class PassagemTest {

    @Test
    void semPassagemAssumeBloqueada() {
        assertEquals(Passagem.BLOQUEADA, Passagem.de(null));
    }

    @Test
    void converteOTextoDoJsonEVolta() {
        assertEquals(Passagem.DIFICIL, Passagem.de("dificil"));
        assertEquals(Passagem.CONTORNAVEL, Passagem.de("contornavel"));
        assertEquals("contornavel", Passagem.CONTORNAVEL.json());
    }

    @Test
    void aceitaAcentoEMaiuscula() {
        assertEquals(Passagem.DIFICIL, Passagem.de(" Difícil "));
        assertEquals(Passagem.CONTORNAVEL, Passagem.de("contornável"));
    }
}
