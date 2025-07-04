/**
 * Core/Thread.ts
 *
 * Modern Worker Thread Management for ROBrowser
 * Manages communication with Web Workers for offloading heavy tasks
 *
 * This file is part of ROBrowser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { Configs } from './Configs';

/**
 * Thread message interface
 */
interface ThreadMessage {
  type: string;
  data?: any;
  uid: number;
  arguments?: any[];
}

/**
 * Thread response interface
 */
interface ThreadResponse {
  uid: number;
  type: string;
  data?: any;
  arguments?: any[];
}

/**
 * Hook callback type
 */
type HookCallback = (data: any) => void;

/**
 * Send callback type
 */
type SendCallback = (...args: any[]) => void;

/**
 * Thread manager class for Web Worker communication
 */
export class Thread {
  private static _memory: Map<number, SendCallback> = new Map();
  private static _hooks: Map<string, HookCallback> = new Map();
  private static _uid = 0;
  private static _origin: string | string[] = [];
  private static _source: Worker | Window | null = null;

  /**
   * Send data to thread worker
   *
   * @param type - Message type identifier
   * @param data - Data to send to worker
   * @param callback - Optional callback for response
   */
  static send(type: string, data?: any, callback?: SendCallback): void {
    if (!this._source) {
      console.error('Thread not initialized. Call Thread.init() first.');
      return;
    }

    let uid = 0;

    if (callback) {
      uid = ++this._uid;
      this._memory.set(uid, callback);
    }

    const message: ThreadMessage = {
      type,
      data,
      uid,
    };

    try {
      if (this._source instanceof Worker) {
        this._source.postMessage(message);
      } else {
        // Window-to-window communication
        (this._source as Window).postMessage(message, this._origin as string);
      }
    } catch (error) {
      console.error('Failed to send message to thread:', error);
      if (callback) {
        this._memory.delete(uid);
      }
    }
  }

  /**
   * Send data with Promise-based response
   *
   * @param type - Message type identifier
   * @param data - Data to send to worker
   * @returns Promise that resolves with worker response
   */
  static async sendAsync<T = any>(type: string, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Thread request timeout for type: ${type}`));
      }, 30000); // 30 second timeout

      this.send(type, data, (...args: any[]) => {
        clearTimeout(timeout);
        if (args.length === 1) {
          resolve(args[0]);
        } else {
          resolve(args as T);
        }
      });
    });
  }

  /**
   * Receive and process data from thread worker
   *
   * @param event - Message event from worker
   */
  private static receive(event: MessageEvent<ThreadResponse>): void {
    const { uid, type, data } = event.data;

    try {
      // Handle direct callback responses
      if (uid && this._memory.has(uid)) {
        const callback = this._memory.get(uid)!;
        
        if (event.data.arguments) {
          callback(...event.data.arguments);
        } else {
          callback(data);
        }
        
        this._memory.delete(uid);
      }

      // Handle hook-based responses
      if (type && this._hooks.has(type)) {
        const hook = this._hooks.get(type)!;
        hook(data);
      }
    } catch (error) {
      console.error('Error processing thread response:', error);
    }
  }

  /**
   * Register a hook for specific message types
   *
   * @param type - Message type to hook
   * @param callback - Callback function to execute
   */
  static hook(type: string, callback: HookCallback): void {
    this._hooks.set(type, callback);
  }

  /**
   * Remove a hook for a specific message type
   *
   * @param type - Message type to unhook
   */
  static unhook(type: string): boolean {
    return this._hooks.delete(type);
  }

  /**
   * Set custom source and origin for thread communication
   * Useful for iframe or cross-origin scenarios
   *
   * @param source - Worker or Window to communicate with
   * @param origin - Origin for cross-origin communication
   */
  static delegate(source: Worker | Window, origin?: string | string[]): void {
    this._source = source;
    this._origin = origin || [];
  }

  /**
   * Initialize the thread worker
   */
  static init(): void {
    if (this._source) {
      console.warn('Thread already initialized');
      return;
    }

    try {
      // Determine worker script path
      const isDevelopment = Configs.getBoolean('development', false);
      const workerPath = isDevelopment 
        ? './ThreadEventHandler.js' 
        : './../../ThreadEventHandler.js';
      
      const version = Configs.getString('version', '');
      const workerUrl = `${workerPath}?${version}`;
      
      this._source = new Worker(workerUrl);

      // Set up message handling
      if (this._source instanceof Worker) {
        this._source.addEventListener('message', this.receive.bind(this));
        this._source.addEventListener('error', this.handleWorkerError.bind(this));
      }

      console.log('Thread worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize thread worker:', error);
      
      // Fallback: try to set up window-to-window communication
      try {
        if (typeof window !== 'undefined') {
          window.addEventListener('message', this.receive.bind(this));
          console.log('Fallback to window communication initialized');
        }
      } catch (fallbackError) {
        console.error('Failed to initialize fallback communication:', fallbackError);
      }
    }
  }

  /**
   * Handle worker errors
   *
   * @param error - Worker error event
   */
  private static handleWorkerError(error: ErrorEvent): void {
    console.error('Thread worker error:', error);
    
    // Clear pending callbacks to prevent memory leaks
    this._memory.clear();
  }

  /**
   * Terminate the worker and clean up resources
   */
  static terminate(): void {
    if (this._source instanceof Worker) {
      this._source.terminate();
    }
    
    this._source = null;
    this._memory.clear();
    this._hooks.clear();
    this._uid = 0;
    
    console.log('Thread worker terminated');
  }

  /**
   * Check if thread is initialized and ready
   */
  static isReady(): boolean {
    return this._source !== null;
  }

  /**
   * Get current pending callback count (for debugging)
   */
  static getPendingCallbacks(): number {
    return this._memory.size;
  }

  /**
   * Get registered hooks (for debugging)
   */
  static getRegisteredHooks(): string[] {
    return Array.from(this._hooks.keys());
  }
}

// Backward compatibility exports
export const { send, hook, init, delegate } = Thread;

// Default export
export default Thread;