/**
 * Fila de Mensagens Assíncrona com Rate-Limit (Anti-Ban) e Retentativas para WhatsApp.
 * Garante intervalo seguro (2.5s) entre envios sequenciais para proteger contra bloqueios de operadora.
 */

import { sendWhatsAppMessage } from "./whatsapp.service.js";

interface QueueItem {
  id: string;
  to: string;
  text: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  priority?: boolean;
}

class WhatsAppQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private sentCount = 0;
  private failedCount = 0;
  private readonly INTERVAL_MS = 2500; // 2.5 segundos de intervalo seguro

  /**
   * Adiciona mensagem à fila de envio.
   */
  enqueue(to: string, text: string, priority = false): string {
    const id = `wq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const item: QueueItem = {
      id,
      to,
      text,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
      priority,
    };

    if (priority) {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }

    this.processNext();
    return id;
  }

  /**
   * Processa o próximo item da fila respeitando o intervalo de vazão.
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const item = this.queue.shift();
    if (!item) {
      this.isProcessing = false;
      return;
    }

    item.attempts++;
    let success = false;

    try {
      success = await sendWhatsAppMessage({ to: item.to, text: item.text });
    } catch (err: any) {
      console.warn(`[WhatsAppQueue] Falha no envio para ${item.to}: ${err.message}`);
    }

    if (success) {
      this.sentCount++;
    } else {
      if (item.attempts < item.maxAttempts) {
        // Reenfileira para nova tentativa com pequeno delay
        console.log(`[WhatsAppQueue] Reenfileirando mensagem para ${item.to} (Tentativa ${item.attempts + 1}/${item.maxAttempts})`);
        setTimeout(() => {
          this.queue.push(item);
          this.processNext();
        }, 5000);
      } else {
        this.failedCount++;
        console.error(`[WhatsAppQueue] Falha definitiva após ${item.maxAttempts} tentativas para ${item.to}`);
      }
    }

    // Aguarda o intervalo de segurança antes de processar o próximo da fila
    setTimeout(() => {
      this.isProcessing = false;
      this.processNext();
    }, this.INTERVAL_MS);
  }

  /**
   * Estatísticas de saúde da fila.
   */
  getStats() {
    return {
      pending: this.queue.length,
      sent: this.sentCount,
      failed: this.failedCount,
      isProcessing: this.isProcessing,
      intervalMs: this.INTERVAL_MS,
    };
  }

  /**
   * Limpa itens pendentes da fila.
   */
  clear() {
    this.queue = [];
  }
}

export const whatsAppQueue = new WhatsAppQueue();
