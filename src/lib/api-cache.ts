interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  set<T>(key: string, data: T, ttlMs: number = 2000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  clear(): void {
    this.cache.clear();
  }
  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}
// Singleton cache instance
export const apiCache = new ApiCache();
// Auto-cleanup every 30 seconds
setInterval(() => {
  apiCache.cleanup();
}, 30000);
// Cache key generators
export const cacheKeys = {
  workspaceStatus: (workspaceId: string) => `workspace:${workspaceId}:status`,
  agentStatus: (workspaceId: string) => `workspace:${workspaceId}:agents`,
};