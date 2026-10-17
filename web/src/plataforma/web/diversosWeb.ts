// Adaptadores menores: GPS, tela ligada, fila no IndexedDB, API HTTP, relógio e ids.

import {
  ErroPlataforma,
  type ApiDeteccoes,
  type ArmazenamentoFila,
  type GeradorId,
  type Localizacao,
  type Posicao,
  type Relogio,
  type ResultadoEnvio,
  type TelaLigada,
} from "../../core/portas";
import type { RegistroDeteccao } from "../../core/tipos";

// ------------------------------------------------------------------ GPS

export class LocalizacaoWeb implements Localizacao {
  private idObservacao: number | null = null;
  private posicao: Posicao | null = null;

  iniciar(): Promise<void> {
    if (!("geolocation" in navigator)) return Promise.reject(new ErroPlataforma("nao_suportado", "sem GPS"));
    if (this.idObservacao !== null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let primeira = true;
      this.idObservacao = navigator.geolocation.watchPosition(
        (p) => {
          this.posicao = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            precisaoM: p.coords.accuracy,
            // mesmo relógio do relogioWeb.agora(), para o núcleo comparar idades
            timestampMs: performance.now(),
          };
          if (primeira) {
            primeira = false;
            resolve();
          }
        },
        (erro) => {
          if (!primeira) return; // erros depois da primeira posição: mantém a última
          primeira = false;
          if (erro.code === erro.PERMISSION_DENIED) {
            this.parar();
            reject(new ErroPlataforma("permissao_negada", erro.message));
          } else reject(new ErroPlataforma("indisponivel", erro.message));
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    });
  }

  ultima(): Posicao | null {
    return this.posicao;
  }

  parar(): void {
    if (this.idObservacao !== null) navigator.geolocation.clearWatch(this.idObservacao);
    this.idObservacao = null;
  }
}

// ------------------------------------------------------------------ Tela ligada

export class TelaLigadaWeb implements TelaLigada {
  private trava: WakeLockSentinel | null = null;
  private desejada = false;

  constructor() {
    // O navegador solta a trava quando a aba some; pede de novo ao voltar
    document.addEventListener("visibilitychange", () => {
      if (this.desejada && document.visibilityState === "visible") void this.pedir();
    });
  }

  private async pedir(): Promise<void> {
    if (!("wakeLock" in navigator) || this.trava) return;
    try {
      this.trava = await navigator.wakeLock.request("screen");
      this.trava.addEventListener("release", () => (this.trava = null));
    } catch {
      // bateria fraca/economia de energia pode negar; o app segue funcionando
    }
  }

  async ativar(): Promise<void> {
    this.desejada = true;
    await this.pedir();
  }

  async liberar(): Promise<void> {
    this.desejada = false;
    await this.trava?.release();
    this.trava = null;
  }
}

// ------------------------------------------------------------------ Fila no IndexedDB

const BANCO = "camera-dv";
const LOJA = "fila_deteccoes";

export class ArmazenamentoIndexedDB implements ArmazenamentoFila {
  private banco: Promise<IDBDatabase> | null = null;

  private abrir(): Promise<IDBDatabase> {
    this.banco ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.banco;
  }

  private async transacao<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
    const banco = await this.abrir();
    return new Promise((resolve, reject) => {
      const tx = banco.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
      tx.onerror = () => reject(tx.error);
    });
  }

  async adicionar(registro: RegistroDeteccao): Promise<void> {
    await this.transacao("readwrite", (l) => l.put(registro));
  }

  listar(limite: number): Promise<RegistroDeteccao[]> {
    return this.transacao("readonly", (l) => l.getAll(undefined, limite) as IDBRequest<RegistroDeteccao[]>);
  }

  async remover(ids: string[]): Promise<void> {
    await this.transacao("readwrite", (l) => void ids.forEach((id) => l.delete(id)));
  }

  contar(): Promise<number> {
    return this.transacao("readonly", (l) => l.count());
  }
}

// ------------------------------------------------------------------ API HTTP

export class ApiHttp implements ApiDeteccoes {
  constructor(private readonly base = "") {}

  async enviar(registros: RegistroDeteccao[]): Promise<ResultadoEnvio> {
    if (!navigator.onLine) return "falha";
    try {
      const resp = await fetch(`${this.base}/deteccoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registros),
      });
      if (resp.ok) return "ok";
      // 408/429 e 5xx são temporários; o resto dos 4xx é dado inválido
      if (resp.status === 408 || resp.status === 429 || resp.status >= 500) return "falha";
      console.warn("Backend rejeitou o lote:", resp.status, await resp.text());
      return "rejeitado";
    } catch {
      return "falha";
    }
  }
}

// ------------------------------------------------------------------ Relógio e ids

export const relogioWeb: Relogio = {
  agora: () => performance.now(),
  agoraIso: () => new Date().toISOString(),
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  aCada: (ms, fn) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};

export const geradorIdWeb: GeradorId = {
  novo: () =>
    crypto.randomUUID?.() ??
    // randomUUID só existe em contexto seguro; alternativa para testes em http local
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
    ),
};
