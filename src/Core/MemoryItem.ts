/**
 * Core/MemoryItem.ts
 *
 * Cache Item into memory
 * Used to manage each object in cache, manage callbacks etc.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Event types for MemoryItem
 */
export type MemoryItemEventType = 'load' | 'error';

/**
 * Event listener function type
 */
export type MemoryItemEventListener<T = any> = (data?: T) => void;

/**
 * Memory item configuration interface
 */
export interface MemoryItemConfig<T = any> {
  onLoad?: MemoryItemEventListener<T>;
  onError?: MemoryItemEventListener<string>;
  autoCleanup?: boolean;
  maxAge?: number;
}

/**
 * Memory item statistics interface
 */
export interface MemoryItemStats {
  created: number;
  lastAccessed: number;
  accessCount: number;
  size?: number;
}

/**
 * Object stored in cache
 * Modern implementation with TypeScript generics and event-driven architecture
 */
export class MemoryItem<T = any> {
  private _data: T | null = null;
  private _error: string = '';
  private _onLoadListeners: MemoryItemEventListener<T>[] = [];
  private _onErrorListeners: MemoryItemEventListener<string>[] = [];
  private _complete: boolean = false;
  private _stats: MemoryItemStats;
  private _config: MemoryItemConfig<T>;

  /**
   * Create a new MemoryItem
   */
  constructor(config: MemoryItemConfig<T> = {}) {
    this._config = {
      autoCleanup: true,
      maxAge: 0,
      ...config
    };

    this._stats = {
      created: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0
    };

    // Store initial callbacks
    if (config.onLoad) {
      this.addEventListener('load', config.onLoad);
    }

    if (config.onError) {
      this.addEventListener('error', config.onError);
    }
  }

  /**
   * Get data from Item with automatic access tracking
   */
  get data(): T | null {
    this._stats.lastAccessed = Date.now();
    this._stats.accessCount++;
    return this._data;
  }

  /**
   * Get error information
   */
  get error(): string {
    return this._error;
  }

  /**
   * Check if the item is loaded
   */
  get complete(): boolean {
    return this._complete;
  }

  /**
   * Get last time the item was accessed
   */
  get lastTimeUsed(): number {
    return this._stats.lastAccessed;
  }

  /**
   * Get item statistics
   */
  get stats(): Readonly<MemoryItemStats> {
    return { ...this._stats };
  }

  /**
   * Check if item has expired based on maxAge
   */
  get isExpired(): boolean {
    if (!this._config.maxAge) return false;
    return Date.now() - this._stats.created > this._config.maxAge;
  }

  /**
   * Add event listener for load/error events
   */
  addEventListener(
    event: MemoryItemEventType,
    callback: MemoryItemEventListener<T> | MemoryItemEventListener<string>
  ): void {
    if (typeof callback !== 'function') {
      throw new Error('MemoryItem::addEventListener() - callback must be a function!');
    }

    switch (event.toLowerCase()) {
      case 'load':
        if (this._complete && this._data !== null) {
          // Item already loaded, execute callback immediately
          (callback as MemoryItemEventListener<T>)(this._data);
          return;
        }
        this._onLoadListeners.push(callback as MemoryItemEventListener<T>);
        break;

      case 'error':
        if (this._complete && this._error) {
          // Item already errored, execute callback immediately
          (callback as MemoryItemEventListener<string>)(this._error);
          return;
        }
        this._onErrorListeners.push(callback as MemoryItemEventListener<string>);
        break;

      default:
        throw new Error(`MemoryItem::addEventListener() - Invalid event "${event}" used.`);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    event: MemoryItemEventType,
    callback: MemoryItemEventListener<T> | MemoryItemEventListener<string>
  ): void {
    switch (event.toLowerCase()) {
      case 'load':
        const loadIndex = this._onLoadListeners.indexOf(callback as MemoryItemEventListener<T>);
        if (loadIndex !== -1) {
          this._onLoadListeners.splice(loadIndex, 1);
        }
        break;

      case 'error':
        const errorIndex = this._onErrorListeners.indexOf(callback as MemoryItemEventListener<string>);
        if (errorIndex !== -1) {
          this._onErrorListeners.splice(errorIndex, 1);
        }
        break;

      default:
        throw new Error(`MemoryItem::removeEventListener() - Invalid event "${event}" used.`);
    }
  }

  /**
   * Execute load callbacks when item is successfully loaded
   */
  onLoad(data: T): void {
    if (this._complete) {
      throw new Error('MemoryItem::onLoad() - Item already completed');
    }

    this._data = data;
    this._complete = true;
    this._stats.lastAccessed = Date.now();

    // Execute all load callbacks
    for (const callback of this._onLoadListeners) {
      try {
        callback(data);
      } catch (error) {
        console.error('MemoryItem load callback error:', error);
      }
    }

    // Auto cleanup if enabled
    if (this._config.autoCleanup) {
      this._cleanup();
    }
  }

  /**
   * Execute error callbacks when an error occurs
   */
  onError(error: string = 'Unknown error'): void {
    if (this._complete) {
      throw new Error('MemoryItem::onError() - Item already completed');
    }

    this._error = error;
    this._complete = true;
    this._stats.lastAccessed = Date.now();

    // Execute all error callbacks
    for (const callback of this._onErrorListeners) {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('MemoryItem error callback error:', callbackError);
      }
    }

    // Auto cleanup if enabled
    if (this._config.autoCleanup) {
      this._cleanup();
    }
  }

  /**
   * Clear all event listeners and data
   */
  destroy(): void {
    this._cleanup();
    this._data = null;
    this._error = '';
    this._complete = false;
  }

  /**
   * Create a Promise-based interface for the MemoryItem
   */
  toPromise(): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this._complete) {
        if (this._data !== null) {
          resolve(this._data);
        } else {
          reject(new Error(this._error || 'Unknown error'));
        }
        return;
      }

      this.addEventListener('load', (data) => resolve(data as T));
      this.addEventListener('error', (error) => reject(new Error(error)));
    });
  }

  /**
   * Clean up event listeners
   */
  private _cleanup(): void {
    this._onLoadListeners.length = 0;
    this._onErrorListeners.length = 0;
  }
}

/**
 * Factory function for creating MemoryItem instances
 */
export function createMemoryItem<T = any>(config?: MemoryItemConfig<T>): MemoryItem<T> {
  return new MemoryItem<T>(config);
}

/**
 * Utility function for creating a MemoryItem with immediate data
 */
export function createLoadedMemoryItem<T>(data: T): MemoryItem<T> {
  const item = new MemoryItem<T>();
  item.onLoad(data);
  return item;
}

/**
 * Utility function for creating a MemoryItem with immediate error
 */
export function createErrorMemoryItem<T = any>(error: string): MemoryItem<T> {
  const item = new MemoryItem<T>();
  item.onError(error);
  return item;
}

export default MemoryItem;