/**
 * Cache em memória ultra-rápido com expiração (TTL) e suporte a invalidação por padrão.
 * Ideal para rotas que lêem dados quase-estáticos (ex: ministérios, repertório musical, convites).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;

  /**
   * Obtém um valor do cache se não estiver expirado.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Armazena um valor com tempo de vida em segundos.
   */
  set<T>(key: string, value: T, ttlSeconds = 60): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalida chaves específicas ou que correspondam a um prefixo/expressão.
   */
  invalidate(pattern: string | RegExp): void {
    if (typeof pattern === "string") {
      for (const key of this.store.keys()) {
        if (key.startsWith(pattern) || key === pattern) {
          this.store.delete(key);
        }
      }
    } else {
      for (const key of this.store.keys()) {
        if (pattern.test(key)) {
          this.store.delete(key);
        }
      }
    }
  }

  /**
   * Limpa todo o cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Métricas de saúde do cache.
   */
  stats() {
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? `${((this.hits / (this.hits + this.misses)) * 100).toFixed(1)}%` : "0%",
    };
  }
}

export const appCache = new MemoryCache();
