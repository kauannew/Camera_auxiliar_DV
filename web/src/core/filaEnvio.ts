// Fila de envio ao mapa colaborativo, resistente a falta de rede:
// tudo vai primeiro para o armazenamento persistente e só sai de lá
// quando o backend confirma (ou rejeita de vez) o lote.

import type { ApiDeteccoes, ArmazenamentoFila } from "./portas";
import type { RegistroDeteccao } from "./tipos";

export class FilaEnvio {
  private enviando = false;

  constructor(
    private readonly armazenamento: ArmazenamentoFila,
    private readonly api: ApiDeteccoes,
    private readonly tamanhoLote: number,
    private readonly aoMudar?: (pendentes: number) => void,
  ) {}

  async enfileirar(registro: RegistroDeteccao): Promise<void> {
    await this.armazenamento.adicionar(registro);
    this.aoMudar?.(await this.armazenamento.contar());
    void this.esvaziar();
  }

  /** Tenta enviar tudo o que está pendente. Seguro para chamar a qualquer momento. */
  async esvaziar(): Promise<void> {
    if (this.enviando) return;
    this.enviando = true;
    try {
      for (;;) {
        const lote = await this.armazenamento.listar(this.tamanhoLote);
        if (lote.length === 0) break;
        const resultado = await this.api.enviar(lote);
        if (resultado === "falha") break; // sem rede: tenta no próximo ciclo
        // "ok" ou "rejeitado" (dado inválido não melhora com reenvio): sai da fila
        await this.armazenamento.remover(lote.map((r) => r.id));
        if (lote.length < this.tamanhoLote) break;
      }
    } finally {
      this.enviando = false;
      this.aoMudar?.(await this.armazenamento.contar());
    }
  }
}
