// src/cacheManager.d.ts
export declare function setCache(key: string, value: any, ttlMs?: number): Promise<void>;
export declare function getCache(key: string): Promise<any | null>;
export declare function deleteCache(key: string): Promise<void>;
export declare function clearAllCache(): Promise<void>;
