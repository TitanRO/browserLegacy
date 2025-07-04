/**
 * Core/MemoryManager.ts
 *
 * Modern Memory Management System for ROBrowser
 * Advanced cache system with automatic cleanup, resource management, and memory monitoring
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import MemoryItem from './MemoryItem';

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  rememberTime: number;
  cleanupInterval: number;
  maxMemoryUsage: number;
  enableLogging: boolean;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalItems: number;
  totalMemoryUsage: number;
  completedItems: number;
  pendingItems: number;
  errorItems: number;
  lastCleanup: number;
  cleanupCount: number;
}

/**
 * File type for resource cleanup
 */
type SupportedFileType = '.spr' | '.pal' | '.str' | '.bmp' | '.wav' | '.mp3' | '.lua' | '.lub' | '.txt' | string;

/**
 * Sprite frame interface
 */
interface SpriteFrame {
  texture?: WebGLTexture;
}

/**
 * Sprite file interface
 */
interface SpriteFile {
  frames?: SpriteFrame[];
  texture?: WebGLTexture;
}

/**
 * Palette file interface
 */
interface PaletteFile {
  texture?: WebGLTexture;
}

/**
 * Modern memory management system with comprehensive resource handling
 */
export class MemoryManager {
  private static memory: Map<string, MemoryItem> = new Map();
  private static config: MemoryConfig = {
    rememberTime: 2 * 60 * 1000, // 2 minutes
    cleanupInterval: 30 * 1000,  // 30 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    enableLogging: true,
  };
  
  private static lastCheckTick = 0;
  private static cleanupCount = 0;
  private static memoryUsage = 0;

  /**
   * Configure memory manager settings
   */
  static configure(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get data from memory with optional callbacks
   */
  static get<T = any>(
    filename: string, 
    onload?: (data: T) => void, 
    onerror?: (error: any) => void
  ): T | null {
    let item = this.memory.get(filename);

    if (!item) {
      item = new MemoryItem();
      this.memory.set(filename, item);
    }

    if (onload) {
      item.addEventListener('load', onload);
    }

    if (onerror) {
      item.addEventListener('error', onerror);
    }

    return item.data as T || null;
  }

  /**
   * Get data with Promise-based API
   */
  static async getAsync<T = any>(filename: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const item = this.memory.get(filename);
      
      if (item?.complete) {
        if (item.error) {
          reject(item.error);
        } else {
          resolve(item.data as T);
        }
        return;
      }

      this.get<T>(filename, resolve, reject);
    });
  }

  /**
   * Check if entry exists in memory
   */
  static exist(filename: string): boolean {
    return this.memory.has(filename);
  }

  /**
   * Check if entry is loaded and ready
   */
  static isReady(filename: string): boolean {
    const item = this.memory.get(filename);
    return item?.complete === true && !item.error;
  }

  /**
   * Store data in memory
   */
  static set(filename: string, data: any, error?: any): void {
    let item = this.memory.get(filename);

    if (!item) {
      item = new MemoryItem();
      this.memory.set(filename, item);
    }

    if (error || !data) {
      item.onerror(error);
    } else {
      item.onload(data);
      this.updateMemoryUsage(filename, data);
    }
  }

  /**
   * Update memory usage tracking
   */
  private static updateMemoryUsage(filename: string, data: any): void {
    let size = 0;

    if (typeof data === 'string') {
      size = data.length * 2; // UTF-16 characters
    } else if (data instanceof ArrayBuffer) {
      size = data.byteLength;
    } else if (data instanceof Uint8Array) {
      size = data.byteLength;
    } else {
      // Rough estimation for objects
      size = JSON.stringify(data).length * 2;
    }

    const item = this.memory.get(filename);
    if (item) {
      item.estimatedSize = size;
      this.memoryUsage += size;
    }
  }

  /**
   * Clean up unused data from memory
   */
  static clean(gl?: WebGL2RenderingContext | WebGLRenderingContext, now = Date.now()): void {
    if (this.lastCheckTick + this.config.cleanupInterval > now) {
      return;
    }

    const cutoffTime = now - this.config.rememberTime;
    const removedFiles: string[] = [];
    let freedMemory = 0;

    for (const [filename, item] of this.memory.entries()) {
      if (item.complete && item.lastTimeUsed < cutoffTime) {
        freedMemory += this.removeInternal(gl, filename);
        removedFiles.push(filename);
      }
    }

    // Force cleanup if memory usage is too high
    if (this.memoryUsage > this.config.maxMemoryUsage) {
      this.forceCleanup(gl, Math.floor(this.memory.size * 0.3)); // Remove 30% of items
    }

    if (removedFiles.length && this.config.enableLogging) {
      console.log(
        `%c[MemoryManager] Cleaned up ${removedFiles.length} items, ` +
        `freed ${this.formatBytes(freedMemory)}`,
        'color:#d35111',
        removedFiles
      );
    }

    this.lastCheckTick = now;
    this.cleanupCount++;
  }

  /**
   * Force cleanup of least recently used items
   */
  private static forceCleanup(gl?: WebGL2RenderingContext | WebGLRenderingContext, count = 10): void {
    const items = Array.from(this.memory.entries())
      .filter(([, item]) => item.complete)
      .sort(([, a], [, b]) => a.lastTimeUsed - b.lastTimeUsed)
      .slice(0, count);

    for (const [filename] of items) {
      this.removeInternal(gl, filename);
    }

    if (this.config.enableLogging) {
      console.warn(`[MemoryManager] Force cleanup removed ${items.length} items due to memory pressure`);
    }
  }

  /**
   * Remove specific item from memory
   */
  static remove(gl?: WebGL2RenderingContext | WebGLRenderingContext, filename?: string): boolean {
    if (!filename || !this.memory.has(filename)) {
      return false;
    }

    this.removeInternal(gl, filename);
    return true;
  }

  /**
   * Internal removal implementation
   */
  private static removeInternal(gl?: WebGL2RenderingContext | WebGLRenderingContext, filename?: string): number {
    if (!filename || !this.memory.has(filename)) {
      return 0;
    }

    const item = this.memory.get(filename)!;
    const data = item.data;
    let freedBytes = item.estimatedSize || 0;

    if (data) {
      freedBytes += this.cleanupResourcesByType(gl, filename, data);
    }

    this.memory.delete(filename);
    this.memoryUsage = Math.max(0, this.memoryUsage - freedBytes);
    
    return freedBytes;
  }

  /**
   * Clean up resources based on file type
   */
  private static cleanupResourcesByType(
    gl?: WebGL2RenderingContext | WebGLRenderingContext,
    filename?: string,
    data?: any
  ): number {
    if (!filename || !data) return 0;

    const ext = this.getFileExtension(filename);
    let freedBytes = 0;

    switch (ext) {
      case '.spr':
        freedBytes += this.cleanupSpriteFile(gl, data as SpriteFile);
        break;

      case '.pal':
        freedBytes += this.cleanupPaletteFile(gl, data as PaletteFile);
        break;

      case '.str':
        freedBytes += this.cleanupStrFile(gl, data);
        break;

      default:
        freedBytes += this.cleanupBlobFile(data);
        break;
    }

    return freedBytes;
  }

  /**
   * Clean up sprite file resources
   */
  private static cleanupSpriteFile(gl?: WebGL2RenderingContext | WebGLRenderingContext, sprite?: SpriteFile): number {
    if (!sprite || !gl) return 0;

    let freedBytes = 0;

    // Clean up frame textures
    if (sprite.frames) {
      for (const frame of sprite.frames) {
        if (frame.texture && gl.isTexture(frame.texture)) {
          gl.deleteTexture(frame.texture);
          freedBytes += 1024; // Estimate
        }
      }
    }

    // Clean up main texture
    if (sprite.texture && gl.isTexture(sprite.texture)) {
      gl.deleteTexture(sprite.texture);
      freedBytes += 1024; // Estimate
    }

    return freedBytes;
  }

  /**
   * Clean up palette file resources
   */
  private static cleanupPaletteFile(gl?: WebGL2RenderingContext | WebGLRenderingContext, palette?: PaletteFile): number {
    if (!palette?.texture || !gl?.isTexture(palette.texture)) {
      return 0;
    }

    gl.deleteTexture(palette.texture);
    return 1024; // Estimate
  }

  /**
   * Clean up STR file resources
   */
  private static cleanupStrFile(gl?: WebGL2RenderingContext | WebGLRenderingContext, strData?: any): number {
    if (!strData?.layers || !gl) return 0;

    let freedBytes = 0;

    for (const layer of strData.layers) {
      if (layer.materials) {
        for (const material of layer.materials) {
          if (material && gl.isTexture(material)) {
            gl.deleteTexture(material);
            freedBytes += 1024; // Estimate
          }
        }
      }
    }

    return freedBytes;
  }

  /**
   * Clean up blob URLs and other resources
   */
  private static cleanupBlobFile(data: any): number {
    if (typeof data === 'string' && data.startsWith('blob:')) {
      URL.revokeObjectURL(data);
      return data.length * 2;
    }
    return 0;
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): SupportedFileType {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() as SupportedFileType : '';
  }

  /**
   * Search files in memory by regex pattern
   */
  static search(pattern: RegExp | string): string[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const results: string[] = [];

    for (const filename of this.memory.keys()) {
      if (regex.test(filename)) {
        results.push(filename);
      }
    }

    return results;
  }

  /**
   * Get memory statistics
   */
  static getStats(): MemoryStats {
    let completedItems = 0;
    let pendingItems = 0;
    let errorItems = 0;

    for (const item of this.memory.values()) {
      if (item.complete) {
        if (item.error) {
          errorItems++;
        } else {
          completedItems++;
        }
      } else {
        pendingItems++;
      }
    }

    return {
      totalItems: this.memory.size,
      totalMemoryUsage: this.memoryUsage,
      completedItems,
      pendingItems,
      errorItems,
      lastCleanup: this.lastCheckTick,
      cleanupCount: this.cleanupCount,
    };
  }

  /**
   * Clear all items from memory
   */
  static clear(gl?: WebGL2RenderingContext | WebGLRenderingContext): void {
    const filenames = Array.from(this.memory.keys());
    
    for (const filename of filenames) {
      this.removeInternal(gl, filename);
    }

    this.memory.clear();
    this.memoryUsage = 0;

    if (this.config.enableLogging) {
      console.log(`[MemoryManager] Cleared all ${filenames.length} items from memory`);
    }
  }

  /**
   * Get all cached filenames
   */
  static getAllFilenames(): string[] {
    return Array.from(this.memory.keys());
  }

  /**
   * Get current memory usage in bytes
   */
  static getUsage(): number {
    return this.memoryUsage;
  }

  /**
   * Get number of cached files
   */
  static getCachedCount(): number {
    return this.memory.size;
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    
    return `${size} ${sizes[i]}`;
  }

  /**
   * Enable/disable debug logging
   */
  static setLogging(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }

  /**
   * Schedule automatic cleanup
   */
  static scheduleCleanup(gl?: WebGL2RenderingContext | WebGLRenderingContext): void {
    setInterval(() => {
      this.clean(gl);
    }, this.config.cleanupInterval);
  }
}

// Legacy exports for backward compatibility
export const { get, set, clean, remove, exist, search } = MemoryManager;

// Default export  
export default MemoryManager;