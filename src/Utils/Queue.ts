/**
 * Utils/Queue.ts
 *
 * Modern Queue System for ROBrowser
 * Generic queue implementation with TypeScript support and async patterns
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Queue callback function type
 */
export type QueueCallback = (queue: Queue) => void | Promise<void>;

/**
 * Queue item with metadata
 */
interface QueueItem {
  callback: QueueCallback;
  id: number;
  timestamp: number;
}

/**
 * Queue options
 */
export interface QueueOptions {
  autoStart?: boolean;
  maxConcurrent?: number;
  timeout?: number;
}

/**
 * Modern queue implementation with comprehensive features
 */
export class Queue {
  private items: QueueItem[] = [];
  private isRunning = false;
  private isPaused = false;
  private currentId = 0;
  private readonly options: Required<QueueOptions>;
  private activeCount = 0;
  private completedCount = 0;
  private errorCount = 0;

  /**
   * Create a new Queue instance
   */
  constructor(options: QueueOptions = {}) {
    this.options = {
      autoStart: false,
      maxConcurrent: 1,
      timeout: 30000,
      ...options,
    };
  }

  /**
   * Add a callback to the queue
   */
  add(callback: QueueCallback): number {
    if (typeof callback !== 'function') {
      throw new Error('Queue.add: callback must be a function');
    }

    const item: QueueItem = {
      callback,
      id: ++this.currentId,
      timestamp: Date.now(),
    };

    this.items.push(item);

    if (this.options.autoStart && !this.isRunning) {
      this.run();
    }

    return item.id;
  }

  /**
   * Add multiple callbacks to the queue
   */
  addAll(callbacks: QueueCallback[]): number[] {
    return callbacks.map(callback => this.add(callback));
  }

  /**
   * Process the next item in the queue
   */
  private async processNext(): Promise<void> {
    if (this.isPaused || this.items.length === 0) {
      return;
    }

    if (this.activeCount >= this.options.maxConcurrent) {
      return;
    }

    const item = this.items.shift();
    if (!item) {
      return;
    }

    this.activeCount++;

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Queue item ${item.id} timed out after ${this.options.timeout}ms`));
        }, this.options.timeout);
      });

      // Execute callback
      const callbackPromise = Promise.resolve(item.callback(this));

      // Race between callback and timeout
      await Promise.race([callbackPromise, timeoutPromise]);
      
      this.completedCount++;
    } catch (error) {
      this.errorCount++;
      console.error(`Queue item ${item.id} failed:`, error);
    } finally {
      this.activeCount--;
      
      // Continue processing if there are more items
      if (this.items.length > 0 && !this.isPaused) {
        setImmediate(() => this.processNext());
      } else if (this.activeCount === 0 && this.items.length === 0) {
        this.isRunning = false;
      }
    }
  }

  /**
   * Start processing the queue
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isPaused = false;

    // Start processing with concurrency control
    const promises: Promise<void>[] = [];
    for (let i = 0; i < Math.min(this.options.maxConcurrent, this.items.length); i++) {
      promises.push(this.processNext());
    }

    await Promise.all(promises);
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    
    if (this.items.length > 0) {
      this.processNext();
    }
  }

  /**
   * Stop queue processing and clear all items
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.items.length = 0;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.items.length = 0;
  }

  /**
   * Remove a specific item by ID
   */
  remove(id: number): boolean {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if the queue is empty
   */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get the number of items in the queue
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * Check if the queue is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Check if the queue is paused
   */
  get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Get the number of active (currently executing) items
   */
  get active(): number {
    return this.activeCount;
  }

  /**
   * Get queue statistics
   */
  get stats(): {
    total: number;
    completed: number;
    errors: number;
    pending: number;
    active: number;
  } {
    return {
      total: this.completedCount + this.errorCount + this.items.length + this.activeCount,
      completed: this.completedCount,
      errors: this.errorCount,
      pending: this.items.length,
      active: this.activeCount,
    };
  }

  /**
   * Get the next callback in line (without removing it)
   */
  peek(): QueueCallback | undefined {
    return this.items[0]?.callback;
  }

  /**
   * Wait for the queue to finish processing all items
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.isEmpty && this.activeCount === 0) {
          resolve();
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });
  }

  /**
   * Create a queue with callbacks that will be executed in sequence
   */
  static sequence(...callbacks: QueueCallback[]): Queue {
    const queue = new Queue({ maxConcurrent: 1 });
    queue.addAll(callbacks);
    return queue;
  }

  /**
   * Create a queue with callbacks that will be executed in parallel
   */
  static parallel(callbacks: QueueCallback[], maxConcurrent?: number): Queue {
    const queue = new Queue({ maxConcurrent: maxConcurrent || callbacks.length });
    queue.addAll(callbacks);
    return queue;
  }

  /**
   * Backward compatibility: next method
   */
  get next(): () => void {
    return () => {
      if (!this.isRunning) {
        this.run();
      }
    };
  }
}

// Legacy Queue class for backward compatibility
export class LegacyQueue {
  private list: (() => void)[] = [];

  add(callback: () => void): void {
    this.list.push(callback);
  }

  private _next(): void {
    if (this.list.length > 0) {
      const callback = this.list.shift();
      if (callback) {
        callback.call(this);
      }
    }
  }

  get next(): () => void {
    return this._next.bind(this);
  }

  run(): void {
    this.next();
  }
}

// Default export
export default Queue;