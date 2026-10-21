// src/services/compressedStorageService.ts

/**
 * Compressed Storage Service with Performance Optimizations
 * Handles localStorage operations with automatic compression/decompression
 * Uses LZ-string algorithm for efficient string compression
 * Includes caching and batch operations for better performance
 */

// LZ-string compression implementation (embedded to avoid dependency)
const LZString = (() => {
  const f = String.fromCharCode;
  const keyStrBase64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const keyStrUriSafe =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const baseReverseDic: { [key: string]: { [key: string]: number } } = {};

  function getBaseValue(alphabet: string, character: string) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }

  const compressToBase64 = (input: string): string => {
    if (input == null) return "";
    const res = _compress(input, 6, (a: number) => keyStrBase64.charAt(a));
    switch (res.length % 4) {
      case 0:
        return res;
      case 1:
        return res + "===";
      case 2:
        return res + "==";
      case 3:
        return res + "=";
      default:
        return res;
    }
  };

  const decompressFromBase64 = (input: string): string | null => {
    if (input == null) return "";
    if (input === "") return null;
    return _decompress(input.length, 32, (index: number) =>
      getBaseValue(keyStrBase64, input.charAt(index)),
    );
  };

  const _compress = (
    uncompressed: string,
    bitsPerChar: number,
    getCharFromInt: (a: number) => string,
  ) => {
    if (uncompressed == null) return "";
    let i, value;
    const context_dictionary: { [key: string]: number } = {};
    const context_dictionaryToCreate: { [key: string]: boolean } = {};
    let context_c = "";
    let context_wc = "";
    let context_w = "";
    let context_enlargeIn = 2;
    let context_dictSize = 3;
    let context_numBits = 2;
    const context_data = [];
    let context_data_val = 0;
    let context_data_position = 0;

    for (let ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (
        !Object.prototype.hasOwnProperty.call(context_dictionary, context_c)
      ) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }

      context_wc = context_w + context_c;
      if (
        Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)
      ) {
        context_w = context_wc;
      } else {
        if (
          Object.prototype.hasOwnProperty.call(
            context_dictionaryToCreate,
            context_w,
          )
        ) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    if (context_w !== "") {
      if (
        Object.prototype.hasOwnProperty.call(
          context_dictionaryToCreate,
          context_w,
        )
      ) {
        if (context_w.charCodeAt(0) < 256) {
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1;
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 8; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 16; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position == bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    value = 2;
    for (i = 0; i < context_numBits; i++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position == bitsPerChar - 1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }

    while (true) {
      context_data_val = context_data_val << 1;
      if (context_data_position == bitsPerChar - 1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      } else context_data_position++;
    }
    return context_data.join("");
  };

  const _decompress = (
    length: number,
    resetValue: number,
    getNextValue: (index: number) => number,
  ): string | null => {
    const dictionary: any[] = [];
    let next;
    let enlargeIn = 4;
    let dictSize = 4;
    let numBits = 3;
    let entry = "";
    const result = [];
    let i;
    let w: any;
    let bits, resb, maxpower, power;
    let c: any;
    const data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }

    bits = 0;
    maxpower = Math.pow(2, 2);
    power = 1;
    while (power != maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch ((next = bits)) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) {
        return "";
      }

      bits = 0;
      maxpower = Math.pow(2, numBits);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((c = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result.push(entry);

      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;

      w = entry;

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  };

  return {
    compressToBase64,
    decompressFromBase64,
  };
})();

interface StorageMetadata {
  compressed: boolean;
  originalSize?: number;
  compressedSize?: number;
  timestamp: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

class CompressedStorageService {
  private readonly COMPRESSION_THRESHOLD = 1024; // Only compress if > 1KB
  private readonly METADATA_SUFFIX = "_meta";
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pendingWrites = new Map<string, any>();
  private writeDebounceTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_DEBOUNCE_DELAY = 100; // 100ms debounce for batch writes

  /**
   * Get item from cache if available and not expired
   */
  private getCachedItem(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set item in cache
   */
  private setCacheItem(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a specific key
   */
  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Batch write pending items to localStorage
   */
  private async batchWritePendingItems(): Promise<void> {
    if (this.pendingWrites.size === 0) return;

    const itemsToWrite = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    for (const [key, value] of itemsToWrite) {
      try {
        await this.writeToStorage(key, value);
      } catch (error) {
        console.error(`[CompressedStorage] Error writing ${key}:`, error);
        // Re-add to pending writes if failed
        this.pendingWrites.set(key, value);
      }
    }
  }

  /**
   * Write item to localStorage with compression
   */
  private async writeToStorage(key: string, value: any): Promise<void> {
    const jsonString = JSON.stringify(value);
    const shouldCompress = jsonString.length > this.COMPRESSION_THRESHOLD;

    if (shouldCompress) {
      const compressed = LZString.compressToBase64(jsonString);
      const metadata: StorageMetadata = {
        compressed: true,
        originalSize: jsonString.length,
        compressedSize: compressed.length,
        timestamp: new Date().toISOString(),
      };

      // Store compressed data
      localStorage.setItem(key, compressed);
      localStorage.setItem(
        `${key}${this.METADATA_SUFFIX}`,
        JSON.stringify(metadata),
      );

      if (import.meta.env.DEV) {
        console.log(
          `[CompressedStorage] Saved ${key} - Original: ${this.formatBytes(jsonString.length)}, Compressed: ${this.formatBytes(compressed.length)} (${this.getCompressionRatio(jsonString.length, compressed.length)}% reduction)`,
        );
      }
    } else {
      // Store uncompressed for small data
      localStorage.setItem(key, jsonString);
      // Remove any existing metadata
      localStorage.removeItem(`${key}${this.METADATA_SUFFIX}`);

      if (import.meta.env.DEV) {
        console.log(
          `[CompressedStorage] Saved ${key} uncompressed - Size: ${this.formatBytes(jsonString.length)}`,
        );
      }
    }
  }

  /**
   * Set item in localStorage with automatic compression (debounced)
   */
  setItem(key: string, value: any): void {
    try {
      // Update cache immediately
      this.setCacheItem(key, value);

      // Add to pending writes
      this.pendingWrites.set(key, value);

      // Debounce the actual write
      if (this.writeDebounceTimer) {
        clearTimeout(this.writeDebounceTimer);
      }

      this.writeDebounceTimer = setTimeout(() => {
        this.batchWritePendingItems();
      }, this.WRITE_DEBOUNCE_DELAY);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error(`[CompressedStorage] Quota exceeded for key: ${key}`);
        this.handleQuotaExceeded(key);
      }
      throw error;
    }
  }

  /**
   * Set item immediately without debouncing
   */
  async setItemImmediate(key: string, value: any): Promise<void> {
    try {
      // Update cache
      this.setCacheItem(key, value);

      // Write directly to storage
      await this.writeToStorage(key, value);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error(`[CompressedStorage] Quota exceeded for key: ${key}`);
        this.handleQuotaExceeded(key);
      }
      throw error;
    }
  }

  /**
   * Get item from localStorage with automatic decompression
   */
  getItem(key: string): any {
    try {
      // Check cache first
      const cached = this.getCachedItem(key);
      if (cached !== null) {
        return cached;
      }

      // Check pending writes
      if (this.pendingWrites.has(key)) {
        const pendingData = this.pendingWrites.get(key);
        this.setCacheItem(key, pendingData);
        return pendingData;
      }

      const storedValue = localStorage.getItem(key);
      if (!storedValue) return null;

      let result: any;

      // Check if data is compressed
      const metadataStr = localStorage.getItem(`${key}${this.METADATA_SUFFIX}`);
      if (metadataStr) {
        const metadata: StorageMetadata = JSON.parse(metadataStr);
        if (metadata.compressed) {
          const decompressed = LZString.decompressFromBase64(storedValue);
          if (decompressed) {
            if (import.meta.env.DEV) {
              console.log(
                `[CompressedStorage] Retrieved ${key} - Decompressed from ${this.formatBytes(metadata.compressedSize || 0)} to ${this.formatBytes(metadata.originalSize || 0)}`,
              );
            }
            result = JSON.parse(decompressed);
          }
        }
      } else {
        // Return as regular JSON if not compressed
        result = JSON.parse(storedValue);
      }

      // Update cache with retrieved data
      if (result !== undefined) {
        this.setCacheItem(key, result);
      }

      return result;
    } catch (error) {
      console.error(`[CompressedStorage] Error retrieving ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove item and its metadata from localStorage
   */
  removeItem(key: string): void {
    // Clear from cache
    this.clearCache(key);

    // Remove from pending writes
    this.pendingWrites.delete(key);

    // Remove from localStorage
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}${this.METADATA_SUFFIX}`);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    used: number;
    available: number;
    items: Array<{
      key: string;
      size: number;
      compressed: boolean;
      compressionRatio?: number;
    }>;
  } {
    const items: any[] = [];
    let totalUsed = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.endsWith(this.METADATA_SUFFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          const size = value.length;
          totalUsed += size;

          const metadataStr = localStorage.getItem(
            `${key}${this.METADATA_SUFFIX}`,
          );
          if (metadataStr) {
            const metadata: StorageMetadata = JSON.parse(metadataStr);
            items.push({
              key,
              size: metadata.compressedSize || size,
              originalSize: metadata.originalSize,
              compressed: true,
              compressionRatio: this.getCompressionRatio(
                metadata.originalSize || 0,
                metadata.compressedSize || 0,
              ),
            });
          } else {
            items.push({
              key,
              size,
              compressed: false,
            });
          }
        }
      }
    }

    // Sort by size descending
    items.sort((a, b) => b.size - a.size);

    // Estimate available space (usually 5-10MB for localStorage)
    const estimatedMaxSize = 5 * 1024 * 1024; // 5MB
    const available = Math.max(0, estimatedMaxSize - totalUsed);

    return {
      used: totalUsed,
      available,
      items,
    };
  }

  /**
   * Clear old/unused data when quota is exceeded
   */
  private handleQuotaExceeded(currentKey: string): void {
    console.warn("[CompressedStorage] Handling quota exceeded error...");

    // Get all project keys
    const projectKeys: Array<{ key: string; lastAccessed: Date }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("skeletonkey_project_") && key !== currentKey) {
        // Try to get last accessed time from recent projects
        const recentProjectsStr = localStorage.getItem("recentProjects");
        let lastAccessed = new Date(0); // Default to very old date

        if (recentProjectsStr) {
          try {
            const recentProjects = JSON.parse(recentProjectsStr);
            const projectId = key.replace("skeletonkey_project_", "");
            const recentEntry = recentProjects.find(
              (p: any) => p.id === projectId,
            );
            if (recentEntry && recentEntry.lastAccessed) {
              lastAccessed = new Date(recentEntry.lastAccessed);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        projectKeys.push({ key, lastAccessed });
      }
    }

    // Sort by last accessed (oldest first)
    projectKeys.sort(
      (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
    );

    // Remove oldest projects until we have space
    const removed: string[] = [];
    for (const { key } of projectKeys) {
      if (removed.length >= 2) break; // Remove at most 2 old projects

      this.removeItem(key);
      removed.push(key);
      console.log(`[CompressedStorage] Removed old project: ${key}`);
    }

    if (removed.length > 0) {
      console.log(
        `[CompressedStorage] Cleared ${removed.length} old projects to free space`,
      );
    } else {
      console.error(
        "[CompressedStorage] No old projects to remove, storage is critically full",
      );
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Calculate compression ratio percentage
   */
  private getCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 0;
    return Math.round((1 - compressed / original) * 100);
  }

  /**
   * Clean up orphaned metadata entries
   */
  cleanupMetadata(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(this.METADATA_SUFFIX)) {
        const dataKey = key.slice(0, -this.METADATA_SUFFIX.length);
        if (!localStorage.getItem(dataKey)) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log(
        `[CompressedStorage] Cleaned up ${keysToRemove.length} orphaned metadata entries`,
      );
    }
  }

  /**
   * Force write all pending items immediately
   */
  async flush(): Promise<void> {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
      this.writeDebounceTimer = null;
    }
    await this.batchWritePendingItems();
  }

  /**
   * Preload multiple keys into cache
   */
  preloadKeys(keys: string[]): void {
    for (const key of keys) {
      // This will load items into cache
      this.getItem(key);
    }
  }
}

// Export singleton instance
export const compressedStorage = new CompressedStorageService();

// Export for backward compatibility
export default compressedStorage;
